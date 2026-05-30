const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src', 'pages', 'config');
const files = fs.readdirSync(dir).filter(f => f.endsWith('Page.tsx') && f !== 'SettingsPage.tsx');

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Change `left: 0` to `left: 'var(--sidebar-width)'`
  content = content.replace(/position:\s*'fixed',\s*left:\s*0,/g, "position: 'fixed', left: 'var(--sidebar-width)',");
  
  // To avoid being trapped by .fade-in, we need to extract it from the <div className="fade-in">
  // All these files return <div className="fade-in" ...> ... <div style={{ position: 'fixed' ... }}>...</div> </div>
  // We can use a regex to replace the wrapper with a fragment.
  // Basically:
  // return (
  //   <div className="fade-in"...
  // becomes
  // return (
  //   <>
  //     <div className="fade-in"...
  
  // And the last closing `</div>` right before `);` or inside the return block needs to be removed and `</>` added.
  // Wait, if I just replace `return (\n    <div className="fade-in"` with `return (\n    <>\n    <div className="fade-in"`
  // and the final `  </div>\n  );\n}` with `  </>\n  );\n}`
  // Let's do this carefully.
  
  // 1. Add fragment start
  if (!content.includes('return (\n    <>\n      <div className="fade-in"')) {
     content = content.replace(/return\s*\(\s*<div\s+className="fade-in"/, 'return (\n    <>\n      <div className="fade-in"');
     // 2. We need to close the <div className="fade-in"> right before the fixed bar, then render the fixed bar, then close the fragment.
     // Find the start of the fixed bar:
     const fixedBarRegex = /<div\s+style={{[^}]*position:\s*'fixed'[^}]*}}>/;
     const match = content.match(fixedBarRegex);
     if (match) {
         // Insert `</div>` before the fixed bar
         const index = match.index;
         content = content.slice(0, index) + '</div>\n      ' + content.slice(index);
         
         // Replace the final </div> that was closing fade-in with </>.
         // Since we just closed it early, the final </div> is now closing the fragment (which is invalid).
         // So we replace the last `</div>\n  );\n}` with `</>\n  );\n}`
         content = content.replace(/<\/div>\s*\);\s*\}\s*$/, '</>\n  );\n}');
     }
  }

  fs.writeFileSync(filePath, content);
  console.log(`Updated ${file}`);
}

// Now handle SettingsPage manually
let settingsContent = fs.readFileSync(path.join(dir, 'SettingsPage.tsx'), 'utf8');
if (!settingsContent.includes('position: \'fixed\'')) {
  // Add the bottom bar to SettingsPage
  // 1. Remove the top save button
  settingsContent = settingsContent.replace(/<button className="btn btn-primary" onClick={handleSave} disabled={saving}>\s*\{saving \? 'Saving\.\.\.' : 'Save Settings'\}\s*<\/button>/, '');
  
  // 2. Add padding bottom
  settingsContent = settingsContent.replace(/<div className="fade-in">/, '<div className="fade-in" style={{ paddingBottom: 88 }}>');
  
  // 3. Apply fragment wrapper
  settingsContent = settingsContent.replace(/return\s*\(\s*<div\s+className="fade-in"/, 'return (\n    <>\n      <div className="fade-in"');
  
  const bottomBar = `
      </div>
      <div style={{ position: 'fixed', left: 'var(--sidebar-width)', right: 0, bottom: 0, borderTop: '1px solid var(--color-border)', background: 'white', height: 64, padding: '0 24px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', zIndex: 20 }}>
        <button className="btn btn-outline" onClick={onBack}>← Back to Overview</button>
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings →'}
        </button>
      </div>
    </>
  );
}
`;
  settingsContent = settingsContent.replace(/<\/div>\s*\);\s*\}\s*$/, bottomBar);
  fs.writeFileSync(path.join(dir, 'SettingsPage.tsx'), settingsContent);
  console.log('Updated SettingsPage.tsx');
}

