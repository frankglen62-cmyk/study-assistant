param(
  [Parameter(Mandatory = $true)]
  [string]$InputPath,

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

$resolvedInput = (Resolve-Path -LiteralPath $InputPath).Path
$resolvedOutput = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputPath)
$outputDirectory = Split-Path -Path $resolvedOutput -Parent
if (-not (Test-Path -LiteralPath $outputDirectory)) {
  New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
}

$zip = [System.IO.Compression.ZipFile]::OpenRead($resolvedInput)

try {
  $workbookXml = Get-ZipText -Zip $zip -EntryName 'xl/workbook.xml'
  if (-not $workbookXml) {
    throw 'Missing xl/workbook.xml'
  }

  $workbookDoc = [xml]$workbookXml
  $ns = [System.Xml.XmlNamespaceManager]::new($workbookDoc.NameTable)
  $ns.AddNamespace('x', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main')
  $ns.AddNamespace('r', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')

  $sheetNode = $workbookDoc.SelectSingleNode("//x:sheet[@name='$SheetName']", $ns)
  if (-not $sheetNode) {
    throw "Sheet '$SheetName' not found."
  }

  $sheetRelId = $sheetNode.GetAttribute('id', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')

  $relsDoc = [xml](Get-ZipText -Zip $zip -EntryName 'xl/_rels/workbook.xml.rels')
  $relsNs = [System.Xml.XmlNamespaceManager]::new($relsDoc.NameTable)
  $relsNs.AddNamespace('p', 'http://schemas.openxmlformats.org/package/2006/relationships')
  $relationshipNode = $relsDoc.SelectSingleNode("//p:Relationship[@Id='$sheetRelId']", $relsNs)
  if (-not $relationshipNode) {
    throw "Worksheet relationship '$sheetRelId' not found."
  }

  $sheetTarget = $relationshipNode.GetAttribute('Target').TrimStart('/')
  $sheetXml = Get-ZipText -Zip $zip -EntryName $sheetTarget
  if (-not $sheetXml) {
    throw "Worksheet XML '$sheetTarget' not found."
  }

  $sheetDoc = [xml]$sheetXml
  $sheetNs = [System.Xml.XmlNamespaceManager]::new($sheetDoc.NameTable)
  $sheetNs.AddNamespace('x', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main')

  $rows = $sheetDoc.SelectNodes('//x:sheetData/x:row', $sheetNs)
  if (-not $rows -or $rows.Count -lt 2) {
    throw 'Workbook does not contain data rows.'
  }

  $headers = @{}
  foreach ($cell in $rows[0].SelectNodes('x:c', $sheetNs)) {
    $reference = $cell.GetAttribute('r')
    $column = ($reference -replace '\d', '')
    $headers[$column] = (Get-CellText -Cell $cell).Trim()
  }

  $records = New-Object System.Collections.Generic.List[object]

  for ($index = 1; $index -lt $rows.Count; $index += 1) {
    $row = $rows[$index]
    $cellMap = @{}

    foreach ($cell in $row.SelectNodes('x:c', $sheetNs)) {
      $reference = $cell.GetAttribute('r')
      $column = ($reference -replace '\d', '')
      $cellMap[$column] = (Get-CellText -Cell $cell).Trim()
    }

    $questionText = $cellMap['C']
    $answerText = $cellMap['D']
    $sourceUrl = $cellMap['E']

    if ([string]::IsNullOrWhiteSpace($questionText) -or [string]::IsNullOrWhiteSpace($answerText)) {
      continue
    }

    $records.Add([pscustomobject]@{
      questionText = $questionText
      answerText   = $answerText
      sourceUrl    = $sourceUrl
    })
  }

  $json = $records | ConvertTo-Json -Depth 4
  [System.IO.File]::WriteAllText($resolvedOutput, $json, [System.Text.UTF8Encoding]::new($false))

  Write-Output ("Converted {0} Q&A rows to {1}" -f $records.Count, $resolvedOutput)
}
finally {
  $zip.Dispose()
}
