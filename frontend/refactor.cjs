const fs = require('fs');
const path = require('path');

const files = [
  'ClassroomsPage.tsx',
  'RoomsPage.tsx',
  'SubjectsPage.tsx',
  'LessonsPage.tsx',
  'ConstraintsPage.tsx'
];

const bottomBar = `
      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, borderTop: '1px solid var(--color-border)', background: 'white', padding: '10px 24px', display: 'flex', alignItems: 'center', zIndex: 20 }}>
        <button className="btn btn-outline" onClick={onBack}>← Back to Overview</button>
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary" onClick={onBack}>
          Save & Continue →
        </button>
      </div>
    </div>
  );
}`;

for (const file of files) {
  const filePath = path.join(__dirname, 'src', 'pages', 'config', file);
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    continue;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace the first <div className="fade-in"> with paddingBottom (we know it's at the start of the return)
  // To be safe, we only want to replace the first one inside the return of the component.
  // Looking at the files, it's always `return (\n    <div className="fade-in">`
  content = content.replace(/return \(\s*<div className="fade-in">/, 'return (\n    <div className="fade-in" style={{ paddingBottom: 88 }}>');
  
  // Replace the very last `    </div>\n  );\n}` with the bottom bar
  const endingPattern = /    <\/div>\s*\);\s*\}\s*$/;
  if (endingPattern.test(content)) {
    content = content.replace(endingPattern, bottomBar);
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${file}`);
  } else {
    console.log(`Ending pattern not found in ${file}`);
  }
}
