param(
  [Parameter(Mandatory = $true)]
  [string[]]$InputPaths,

  [Parameter(Mandatory = $true)]
  [string]$OutputPath,

  [string]$SheetName = 'Q&A'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.IO.Compression.FileSystem

function Get-ZipText {
  param(
    [System.IO.Compression.ZipArchive]$Zip,
    [string]$EntryName
  )

  $entry = $Zip.Entries | Where-Object { $_.FullName -eq $EntryName } | Select-Object -First 1
  if (-not $entry) {
    return $null
  }

  $reader = [System.IO.StreamReader]::new($entry.Open())
  try {
    return $reader.ReadToEnd()
  }
  finally {
    $reader.Dispose()
  }
}

function Get-CellText {
  param(
    [System.Xml.XmlElement]$Cell
  )

  if (-not $Cell) {
    return ''
  }

  $inline = $Cell.GetElementsByTagName('t')
  if ($inline.Count -gt 0) {
    return ($inline | ForEach-Object { $_.InnerText }) -join ''
  }

  $valueNode = $Cell.GetElementsByTagName('v') | Select-Object -First 1
  if ($valueNode) {
    return $valueNode.InnerText
  }

  return ''
}

function Normalize-Whitespace {
  param(
    [string]$Value
  )

  if ([string]::IsNullOrWhiteSpace($Value)) {
    return ''
  }

  return (($Value -replace '\s+', ' ').Trim())
}

function Convert-WorkbookRows {
  param(
    [string]$Path,
    [string]$WorksheetName
  )

  $resolvedPath = (Resolve-Path -LiteralPath $Path).Path
  $zip = [System.IO.Compression.ZipFile]::OpenRead($resolvedPath)

  try {
    $workbookXml = Get-ZipText -Zip $zip -EntryName 'xl/workbook.xml'
    if (-not $workbookXml) {
      throw "Missing xl/workbook.xml in '$resolvedPath'."
    }

    $workbookDoc = [xml]$workbookXml
    $ns = [System.Xml.XmlNamespaceManager]::new($workbookDoc.NameTable)
    $ns.AddNamespace('x', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main')
    $ns.AddNamespace('r', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')

    $sheetNode = $workbookDoc.SelectSingleNode("//x:sheet[@name='$WorksheetName']", $ns)
    if (-not $sheetNode) {
      $sheetNode = $workbookDoc.SelectSingleNode("//x:sheet[contains(@name, 'Q&A')]", $ns)
    }
    if (-not $sheetNode) {
      $sheetNode = $workbookDoc.SelectSingleNode('//x:sheets/x:sheet[1]', $ns)
    }
    if (-not $sheetNode) {
      throw "No worksheets were found in '$resolvedPath'."
    }

    $sheetRelId = $sheetNode.GetAttribute('id', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')
    $relsDoc = [xml](Get-ZipText -Zip $zip -EntryName 'xl/_rels/workbook.xml.rels')
    $relsNs = [System.Xml.XmlNamespaceManager]::new($relsDoc.NameTable)
    $relsNs.AddNamespace('p', 'http://schemas.openxmlformats.org/package/2006/relationships')
    $relationshipNode = $relsDoc.SelectSingleNode("//p:Relationship[@Id='$sheetRelId']", $relsNs)
    if (-not $relationshipNode) {
      throw "Worksheet relationship '$sheetRelId' not found in '$resolvedPath'."
    }

    $sheetTarget = $relationshipNode.GetAttribute('Target').TrimStart('/')
    $sheetXml = Get-ZipText -Zip $zip -EntryName $sheetTarget
    if (-not $sheetXml) {
      throw "Worksheet XML '$sheetTarget' not found in '$resolvedPath'."
    }

    $sheetDoc = [xml]$sheetXml
    $sheetNs = [System.Xml.XmlNamespaceManager]::new($sheetDoc.NameTable)
    $sheetNs.AddNamespace('x', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main')

    $rows = $sheetDoc.SelectNodes('//x:sheetData/x:row', $sheetNs)
    if (-not $rows -or $rows.Count -lt 2) {
      return @()
    }

    $headerMap = @{}
    $headerRowIndex = -1

    for ($rowIndex = 0; $rowIndex -lt $rows.Count; $rowIndex += 1) {
      $candidateHeaderMap = @{}
      foreach ($cell in $rows[$rowIndex].SelectNodes('x:c', $sheetNs)) {
        $reference = $cell.GetAttribute('r')
        $column = ($reference -replace '\d', '')
        $header = Normalize-Whitespace (Get-CellText -Cell $cell)
        if ($header) {
          $candidateHeaderMap[$header.ToLowerInvariant()] = $column
        }
      }

      if ($candidateHeaderMap.ContainsKey('question') -and $candidateHeaderMap.ContainsKey('correct answer')) {
        $headerMap = $candidateHeaderMap
        $headerRowIndex = $rowIndex
        break
      }
    }

    $questionColumn = $headerMap['question']
    $answerColumn = $headerMap['correct answer']
    $sourceColumn = $headerMap['source url']
    $subjectColumn = $headerMap['subject name']

    if (-not $questionColumn -or -not $answerColumn) {
      throw "Workbook '$resolvedPath' is missing Question/Correct Answer columns."
    }

    $records = New-Object System.Collections.Generic.List[object]

    for ($index = $headerRowIndex + 1; $index -lt $rows.Count; $index += 1) {
      $row = $rows[$index]
      $cellMap = @{}

      foreach ($cell in $row.SelectNodes('x:c', $sheetNs)) {
        $reference = $cell.GetAttribute('r')
        $column = ($reference -replace '\d', '')
        $cellMap[$column] = Normalize-Whitespace (Get-CellText -Cell $cell)
      }

      $questionText = $cellMap[$questionColumn]
      $answerText = $cellMap[$answerColumn]
      $sourceUrl = if ($sourceColumn) { $cellMap[$sourceColumn] } else { '' }
      $sourceSubject = if ($subjectColumn) { $cellMap[$subjectColumn] } else { '' }

      if ([string]::IsNullOrWhiteSpace($questionText) -or [string]::IsNullOrWhiteSpace($answerText)) {
        continue
      }

      $records.Add([pscustomobject]@{
        sourceWorkbook = [System.IO.Path]::GetFileName($resolvedPath)
        sourceSubject  = $sourceSubject
        questionText   = $questionText
        answerText     = $answerText
        sourceUrl      = $sourceUrl
      })
    }

    return $records
  }
  finally {
    $zip.Dispose()
  }
}

$resolvedOutput = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputPath)
$outputDirectory = Split-Path -Path $resolvedOutput -Parent
if (-not (Test-Path -LiteralPath $outputDirectory)) {
  New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
}

$allRecords = New-Object System.Collections.Generic.List[object]

foreach ($inputPath in $InputPaths) {
  foreach ($record in (Convert-WorkbookRows -Path $inputPath -WorksheetName $SheetName)) {
    $allRecords.Add($record)
  }
}

$json = $allRecords | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText($resolvedOutput, $json, [System.Text.UTF8Encoding]::new($false))

Write-Output ("Merged {0} Q&A rows from {1} workbook(s) to {2}" -f $allRecords.Count, $InputPaths.Count, $resolvedOutput)
