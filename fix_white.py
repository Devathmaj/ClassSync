import os, glob

files_to_check = glob.glob(r'd:\Timetable\frontend\src\pages\config\*.tsx')
files_to_check.append(r'd:\Timetable\frontend\src\pages\CalendarPage.tsx')
files_to_check.append(r'd:\Timetable\frontend\src\pages\TimetableEditorPage.tsx')
files_to_check.append(r'd:\Timetable\frontend\src\index.css')

for fp in files_to_check:
    with open(fp, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Fix fixed bottom bars
    content = content.replace("background: 'white'", "background: 'var(--color-surface)'")
    
    # Fix CalendarPage styles
    content = content.replace('background: white !important;', 'background: var(--color-surface) !important;')
    
    # Fix index.css data-table hover
    content = content.replace('background: #FAFBFF;', 'background: var(--color-bg);')
    content = content.replace('background-color: white;', 'background-color: var(--color-surface);')

    # Fix TimetableEditorPage
    content = content.replace("wrapper.style.background = 'white';", "wrapper.style.background = 'var(--color-surface)';")
    
    with open(fp, 'w', encoding='utf-8') as f:
        f.write(content)

print('Fixed bottom bars and calendar buttons.')
