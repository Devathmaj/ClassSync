import os

fp = r'd:\Timetable\frontend\src\pages\TimetableOverviewPage.tsx'
with open(fp, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("'rgba(251, 191, 36, 0.1)'", "'var(--color-note-bg-yellow)'")
content = content.replace("'1px solid rgba(251, 191, 36, 0.3)'", "'1px solid var(--color-note-border-yellow)'")

content = content.replace("'rgba(34, 211, 238, 0.1)'", "'var(--color-note-bg-blue)'")
content = content.replace("'1px solid rgba(34, 211, 238, 0.3)'", "'1px solid var(--color-note-border-blue)'")

content = content.replace("'rgba(52, 211, 153, 0.1)'", "'var(--color-note-bg-green)'")
content = content.replace("'1px solid rgba(52, 211, 153, 0.3)'", "'1px solid var(--color-note-border-green)'")

content = content.replace("'rgba(244, 114, 182, 0.1)'", "'var(--color-note-bg-red)'")
content = content.replace("'1px solid rgba(244, 114, 182, 0.3)'", "'1px solid var(--color-note-border-red)'")

# Extra dark mode fixes previously hardcoded
content = content.replace("'rgba(248, 113, 113, 0.1)'", "'var(--color-note-bg-red)'")
content = content.replace("'1px solid #F87171'", "'1px solid var(--color-note-border-red)'")

content = content.replace("'rgba(163, 230, 53, 0.1)'", "'var(--color-note-bg-green)'")
content = content.replace("'1px solid var(--color-primary)'", "'1px solid var(--color-note-border-green)'")
content = content.replace("'rgba(248, 113, 113, 0.1)'", "'var(--color-note-bg-red)'")

with open(fp, 'w', encoding='utf-8') as f:
    f.write(content)

fp2 = r'd:\Timetable\frontend\src\pages\AnalyticsPage.tsx'
with open(fp2, 'r', encoding='utf-8') as f:
    content2 = f.read()

content2 = content2.replace("'rgba(52, 211, 153, 0.1)'", "'var(--color-note-bg-green)'")
content2 = content2.replace("'rgba(52, 211, 153, 0.3)'", "'var(--color-note-border-green)'")

content2 = content2.replace("'rgba(251, 191, 36, 0.1)'", "'var(--color-note-bg-yellow)'")
content2 = content2.replace("'rgba(251, 191, 36, 0.3)'", "'var(--color-note-border-yellow)'")

content2 = content2.replace("'rgba(34, 211, 238, 0.1)'", "'var(--color-note-bg-blue)'")
content2 = content2.replace("'rgba(34, 211, 238, 0.3)'", "'var(--color-note-border-blue)'")

content2 = content2.replace("'rgba(167, 139, 250, 0.1)'", "'var(--color-note-bg-blue)'")
content2 = content2.replace("'rgba(167, 139, 250, 0.3)'", "'var(--color-note-border-blue)'")

content2 = content2.replace("'rgba(244, 114, 182, 0.1)'", "'var(--color-note-bg-red)'")
content2 = content2.replace("'rgba(244, 114, 182, 0.3)'", "'var(--color-note-border-red)'")

content2 = content2.replace("'rgba(250, 204, 21, 0.1)'", "'var(--color-note-bg-yellow)'")
content2 = content2.replace("'rgba(250, 204, 21, 0.3)'", "'var(--color-note-border-yellow)'")

# Fix linear gradient in AnalyticsPage
content2 = content2.replace("linear-gradient(135deg, rgba(163, 230, 53, 0.1), rgba(163, 230, 53, 0.05))", "var(--color-surface)")

with open(fp2, 'w', encoding='utf-8') as f:
    f.write(content2)

print('Updated Analytics and Overview pages')
