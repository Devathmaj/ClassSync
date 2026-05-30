export default function HelpDocsPage() {
  return (
    <div className="fade-in">
      <div className="top-header">
        <div>
          <h1 className="header-greeting">Help & Documentation</h1>
          <p className="header-sub">Learn how to configure, generate, and manage your timetables.</p>
        </div>
      </div>

      <div className="page-content" style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ maxWidth: 900, width: '100%', display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 60 }}>
          
          {/* Section 1: Overview */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">1. Introduction to ClassSync</span>
            </div>
            <div className="card-body">
              <p style={{ marginBottom: 16 }}>
                ClassSync is an automated timetable generation engine that uses constraint satisfaction algorithms to balance teachers, classrooms, subjects, and specific time constraints to create a conflict-free schedule.
              </p>
              <p>
                To generate a successful timetable, you must first define your <strong>Global Catalog</strong> (Master Data), then associate that data with a specific Timetable instance, and finally define rules and constraints before running the generation engine.
              </p>
            </div>
          </div>

          {/* Section 2: Master Data */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">2. Managing Master Data</span>
            </div>
            <div className="card-body">
              <p style={{ marginBottom: 16 }}>
                Before creating a timetable, populate your global catalog. This data is shared across all your timetables.
              </p>
              <ul style={{ paddingLeft: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <li>
                  <strong>Faculty:</strong> The teachers or instructors in your institution. Each faculty member can have maximum working hour limits and unavailabilities.
                </li>
                <li>
                  <strong>Classrooms / Divisions:</strong> The distinct groups of students (e.g., "Grade 10A"). A classroom cannot have two lessons scheduled at the exact same time.
                </li>
                <li>
                  <strong>Rooms:</strong> The physical locations (e.g., "Science Lab 1", "Room 102"). Rooms also cannot be double-booked.
                </li>
                <li>
                  <strong>Subjects:</strong> The curriculum courses (e.g., "Mathematics", "Physical Education").
                </li>
              </ul>
            </div>
          </div>

          {/* Section 3: Configuration */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">3. Configuring a Timetable</span>
            </div>
            <div className="card-body">
              <p style={{ marginBottom: 16 }}>
                Once your master data is ready, create a new Timetable from the Dashboard. You will then need to configure its specific parameters:
              </p>
              <ul style={{ paddingLeft: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <li>
                  <strong>Bell Schedule:</strong> Define the exact start and end times for each period in a day. You can also specify <em>Break</em> periods (like Lunch or Recess) where no lessons should be scheduled.
                </li>
                <li>
                  <strong>Lessons:</strong> Combine your master data to define what needs to be taught. For example, <em>"Grade 10A"</em> takes <em>"Math"</em> with <em>"Mr. Smith"</em> in <em>"Room 101"</em> for <em>4 periods a week</em>.
                </li>
                <li>
                  <strong>Constraints:</strong> Add specific rules to guide the AI. Examples include "Mr. Smith is unavailable on Friday mornings" or "Grade 10A must not have Math and Science on the same day."
                </li>
              </ul>
            </div>
          </div>

          {/* Section 4: Generation */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">4. Generation and Editing</span>
            </div>
            <div className="card-body">
              <p style={{ marginBottom: 16 }}>
                After all configuration is complete, click <strong>Generate Schedule</strong>. The system will dispatch the heavy computation to a background Celery worker. 
              </p>
              <div className="tip-card tip-blue" style={{ marginBottom: 16 }}>
                <div className="tip-title">Pro Tip: Generation Speed</div>
                <div>The time it takes to generate a schedule depends entirely on how heavily constrained your data is. Ensure you provide enough "slack" (empty periods and spare rooms) so the AI can resolve conflicts efficiently.</div>
              </div>
              <p>
                Once generation is complete, you can jump into the <strong>Timetable Editor</strong> to drag and drop lessons, swap periods, and manually fix any edge cases. After you're satisfied, you can <strong>Publish</strong> the timetable for public view!
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
