const { createClient } = require('@supabase/supabase-js');


const TARGET_LIST = [
  "2D/3D Digital Animation — CS-6211",
  "Application Development and Emerging Technology — ITE-6200",
  "Application Life Cycle Management — CS-6302",
  "Art Appreciation — GE-6115",
  "Audio and Video Production (Digital Imaging) — CS-6321",
  "Calculus 1 — MATH-6100",
  "Calculus-Based Physics 1 — NSCI-6100",
  "Calculus-Based Physics 2 — NSCI-6101",
  "Cloud Computing and the Internet of Things — ITE-6300",
  "Computer Programming 1 — ITE-6102",
  "Computer Programming 2 — ITE-6104",
  "Current Trends and Issues — COMP-6103",
  "Data Analysis — MATH-6200",
  "Data Communications and Networking 1 — IT-6201",
  "Data Communications and Networking 2 — IT-6223",
  "Data Communications and Networking 3 — IT-6224",
  "Data Communications and Networking 4 — IT-6300",
  "Data Structures and Algorithm Analysis — ITE-6201",
  "Database Management System 1 (Oracle) — IT-6202",
  "Database Management System 2 (Oracle 10g Admin) — IT-6203",
  "Discrete Mathematics — CS-6105",
  "Environmental Science — GE-6200",
  "Ethics — GE-6107",
  "Euthenics 1 — ETHNS-6101",
  "Euthenics 2 — ETHNS-6102",
  "Foreign Language — FLN-6300",
  "Individual/Dual Sports — PHYED-6103",
  "Information Assurance and Security 1 — IT-6205A",
  "Information Assurance and Security 2 — IT-6206A",
  "Information Management — ITE-6220",
  "Integrative Programming and Technology 1 — IT-6302",
  "Introduction to Human Computer Interaction — IT-6200",
  "Introduction to Multimedia — IT-6209",
  "Kritikal na Pagbasa, Pagsulat at Pagsasalita — FILI-6201",
  "Life and Works of Jose Rizal — GE-6300",
  "Living in the IT Era — GE-6221",
  "Load Testing — CS-6303",
  "Mathematics in the Modern World — GE-6114",
  "National Service Training Program 1 — NSTP-6101",
  "National Service Training Program 2 — NSTP-6102",
  "Object Oriented Programming — CS-6203",
  "Pagsasaling Pampanitikan — FILI-6301",
  "Physical Fitness — PHYED-6101",
  "Principles of Operating Systems and its Applications — CS-6206",
  "Purposive Communication 1 — GE-6106",
  "Purposive Communication 2 — ENGL-6100",
  "Quantitative Methods — IT-6210",
  "Readings in Philippine History — GE-6101",
  "Rhythmic Activities — PHYED-6102",
  "Science, Technology and Society — GE-6116",
  "Social and Professional Issues — ITE-6202",
  "Software Engineering 1 — CS-6209",
  "System Administration and Maintenance — IT-6301",
  "System Integration and Architecture 1 — IT-6208",
  "Team Sports — PHYED-6200",
  "Technopreneurship — ITE-6301",
  "The Contemporary World — GE-6102",
  "Understanding the Self — GE-6100",
  "Unified Functional Testing — CS-6306"
];

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function syncSubjects() {
  console.log("Fetching existing subjects from Supabase...");
  const { data: dbSubjects, error } = await supabase.from('subjects').select('*');
  if (error) throw error;

  console.log(`Found ${dbSubjects.length} subjects in the database.`);

  const missingList = [];
  let updatedCount = 0;

  for (const item of TARGET_LIST) {
    // Expected format: "Subject Name — CODE-XXX"
    const parts = item.split(' — ');
    let nameTarget = parts[0].trim();
    let codeTarget = parts.length > 1 ? parts[1].trim() : null;

    // Special cleanups just in case for matching
    // Replace strange hyphens with standard dashes for comparison, etc.
    let searchName = nameTarget.toLowerCase().replace(/[^a-z0-9]/g, '');

    const matchRow = dbSubjects.find(sub => {
      let dbSearchName = sub.name.split(' — ')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      return dbSearchName === searchName;
    });

    if (!matchRow) {
      missingList.push(item);
    } else {
      // Update the subject
      // Append the code to the subject name explicitly, but don't duplicate
      let finalName = matchRow.name;
      if (!finalName.includes(' — ') && codeTarget) {
        finalName = `${nameTarget} — ${codeTarget}`;
      } else if (finalName.includes(' — ')) {
        // Just normalize existing
        finalName = `${nameTarget} — ${codeTarget}`;
      }

      if (matchRow.name !== finalName || matchRow.course_code !== codeTarget) {
        const { error: updateErr } = await supabase
          .from('subjects')
          .update({
            name: finalName,
            course_code: codeTarget
          })
          .eq('id', matchRow.id);
        
        if (updateErr) {
          console.error(`Failed to update ${item}`, updateErr);
        } else {
          updatedCount++;
          console.log(`✅ Updated: ${finalName}`);
        }
      } else {
        console.log(`⚡ Unchanged: ${finalName}`);
      }
    }
  }

  console.log("\n=========================");
  console.log("RESULTS SUMMARY");
  console.log("=========================");
  console.log(`Total Targets Provided: ${TARGET_LIST.length}`);
  console.log(`Existing and Found: ${TARGET_LIST.length - missingList.length}`);
  console.log(`Modified in this run: ${updatedCount}`);
  console.log(`Missing Subjects: ${missingList.length}`);

  if (missingList.length > 0) {
    console.log("\nThe following subjects are MISSING in your web app database:");
    missingList.forEach(m => console.log(`- ${m}`));
  }
}

syncSubjects().catch(console.error);
