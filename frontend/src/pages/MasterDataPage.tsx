import { useEffect, useState } from 'react';
import { facultyApi, subjectApi, classroomApi, roomApi, usersApi } from '../api';
import type { Faculty, Subject, Classroom, Room } from '../types';
import { useAuth } from '../context/AuthContext';

export default function MasterDataPage() {
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const [hierarchy, setHierarchy] = useState<any[]>([]);
  const [selectedInst, setSelectedInst] = useState<string>(''); // empty means All Institutions

  useEffect(() => {
    if (user?.role === 'admin') {
      usersApi.getHierarchy().then(setHierarchy).catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      facultyApi.listGlobal(selectedInst || undefined),
      subjectApi.listGlobal(selectedInst || undefined),
      classroomApi.listGlobal(selectedInst || undefined),
      roomApi.listGlobal(selectedInst || undefined)
    ]).then(([f, s, c, r]) => {
      setFaculty(f);
      setSubjects(s);
      setClassrooms(c);
      setRooms(r);
    }).catch(err => {
      console.error(err);
    }).finally(() => {
      setLoading(false);
    });
  }, [selectedInst]);

  return (
    <div className="fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div className="top-header">
        <div>
          <h1 className="header-greeting">Master Data</h1>
          <p className="header-sub">View your global catalog of Faculties, Subjects, Classrooms, and Rooms.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {user?.role === 'admin' && (
            <select
              className="form-input"
              style={{ width: 250 }}
              value={selectedInst}
              onChange={e => setSelectedInst(e.target.value)}
            >
              <option value="">All Institutions</option>
              {hierarchy.map(inst => (
                <option key={inst.id} value={inst.id}>{inst.full_name}</option>
              ))}
            </select>
          )}
          {loading && <span className="text-sm text-muted pulse">Loading…</span>}
        </div>
      </div>
      
      <div className="page-content" style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ maxWidth: 1200, width: '100%', display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 60 }}>
          {loading ? (
            <p>Loading master data...</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              {/* Faculty Card */}
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Faculty ({faculty.length})</span>
                </div>
                <div className="card-body" style={{ maxHeight: 300, overflowY: 'auto' }}>
                  {faculty.length === 0 ? <p className="text-muted">No faculty defined.</p> : (
                    <table className="table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                      <thead><tr><th>Name</th><th>Email</th><th>Designation</th></tr></thead>
                      <tbody>
                        {faculty.map(f => (
                          <tr key={f.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                            <td style={{ padding: '8px 0' }}>{f.full_name}</td>
                            <td style={{ padding: '8px 0', color: 'var(--color-text-muted)' }}>{f.email}</td>
                            <td style={{ padding: '8px 0' }}>{f.designation || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Subjects Card */}
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Subjects ({subjects.length})</span>
                </div>
                <div className="card-body" style={{ maxHeight: 300, overflowY: 'auto' }}>
                  {subjects.length === 0 ? <p className="text-muted">No subjects defined.</p> : (
                    <table className="table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                      <thead><tr><th>Name</th><th>Code</th><th>Availability</th></tr></thead>
                      <tbody>
                        {subjects.map(s => (
                          <tr key={s.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                            <td style={{ padding: '8px 0' }}>{s.name}</td>
                            <td style={{ padding: '8px 0' }}><span className="badge">{s.short_name}</span></td>
                            <td style={{ padding: '8px 0' }}>{s.availability}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Classrooms Card */}
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Classrooms ({classrooms.length})</span>
                </div>
                <div className="card-body" style={{ maxHeight: 300, overflowY: 'auto' }}>
                  {classrooms.length === 0 ? <p className="text-muted">No classrooms defined.</p> : (
                    <table className="table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                      <thead><tr><th>Name</th><th>Students</th></tr></thead>
                      <tbody>
                        {classrooms.map(c => (
                          <tr key={c.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                            <td style={{ padding: '8px 0' }}>{c.name}</td>
                            <td style={{ padding: '8px 0', color: 'var(--color-text-muted)' }}>{c.student_count || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Rooms Card */}
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Rooms ({rooms.length})</span>
                </div>
                <div className="card-body" style={{ maxHeight: 300, overflowY: 'auto' }}>
                  {rooms.length === 0 ? <p className="text-muted">No rooms defined.</p> : (
                    <table className="table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                      <thead><tr><th>Name</th><th>Capacity</th><th>Availability</th></tr></thead>
                      <tbody>
                        {rooms.map(r => (
                          <tr key={r.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                            <td style={{ padding: '8px 0' }}>{r.name}</td>
                            <td style={{ padding: '8px 0' }}>{r.capacity}</td>
                            <td style={{ padding: '8px 0' }}>{r.building_name || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
