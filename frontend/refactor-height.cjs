const fs = require('fs');
const path = require('path');

const files = [
  'TimetableDetailsPage.tsx',
  'BellSchedulePage.tsx',
  'FacultyPage.tsx',
  'ClassroomsPage.tsx',
  'RoomsPage.tsx',
  'SubjectsPage.tsx',
  'LessonsPage.tsx',
  'ConstraintsPage.tsx'
];

for (const file of files) {
  const filePath = path.join(__dirname, 'src', 'pages', 'config', file);
  if (!fs.existsSync(filePath)) continue;
  
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/padding:\s*'10px 24px'/g, "height: 64, padding: '0 24px', boxSizing: 'border-box'");
  fs.writeFileSync(filePath, content);
  console.log(`Updated height for ${file}`);
}
