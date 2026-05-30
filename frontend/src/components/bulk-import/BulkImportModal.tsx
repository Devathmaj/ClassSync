import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Papa from 'papaparse';

export interface ColumnConfig {
  name: string;
  required: boolean;
}

export interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  expectedColumns: ColumnConfig[];
  onImport: (file: File) => Promise<{ imported: number; skipped: number }>;
  onDownloadTemplate: () => void;
  onSuccess: () => void;
}

type ModalStep = 'idle' | 'parsing' | 'preview' | 'importing' | 'success' | 'fatal_error';

export default function BulkImportModal({
  isOpen,
  onClose,
  title,
  subtitle,
  expectedColumns,
  onImport,
  onDownloadTemplate,
  onSuccess
}: BulkImportModalProps) {
  const [step, setStep] = useState<ModalStep>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  
  // Validation results
  const [fatalErrors, setFatalErrors] = useState<string[]>([]);
  const [rowErrors, setRowErrors] = useState<{row: number, msg: string}[]>([]);
  const [warnings, setWarnings] = useState<{row: number, msg: string}[]>([]);
  
  // Import result
  const [importResult, setImportResult] = useState<{imported: number, skipped: number} | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state on close
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setStep('idle');
        setFile(null);
        setParsedData([]);
        setHeaders([]);
        setFatalErrors([]);
        setRowErrors([]);
        setWarnings([]);
        setImportResult(null);
      }, 300);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSafeClose = () => {
    if (step === 'importing') return; // Cannot close while importing
    if (step === 'preview' && file) {
      if (!confirm('You have unimported data. Are you sure you want to close?')) return;
    }
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      processFile(selected);
    }
    // Reset input so the same file can be selected again if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processFile = (selectedFile: File) => {
    setFile(selectedFile);
    setStep('parsing');
    setFatalErrors([]);
    setRowErrors([]);
    setWarnings([]);

    Papa.parse<Record<string, string>>(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        validateData(results.data, results.meta.fields || []);
      },
      error: (err) => {
        setFatalErrors([`Failed to parse CSV: ${err.message}`]);
        setStep('fatal_error');
      }
    });
  };

  const validateData = (data: Record<string, string>[], fileHeaders: string[]) => {
    const currentFatal: string[] = [];
    const currentRowErrs: {row: number, msg: string}[] = [];
    const currentWarnings: {row: number, msg: string}[] = [];

    // 1. Check for required columns
    const missingColumns = expectedColumns
      .filter(c => c.required)
      .map(c => c.name)
      .filter(reqCol => !fileHeaders.includes(reqCol));

    if (missingColumns.length > 0) {
      currentFatal.push(`Missing required columns: ${missingColumns.join(', ')}`);
    }

    if (data.length === 0) {
      currentFatal.push("The CSV file is empty or contains no valid rows.");
    }

    // 2. Row level validation
    if (currentFatal.length === 0) {
      // Find duplicates internally by 'Name' or similar primary identifier.
      // Usually the first required column is the primary name
      const primaryCol = expectedColumns[0]?.name;
      const seenNames = new Set<string>();

      data.forEach((row, index) => {
        const rowNum = index + 2; // +1 for 0-index, +1 for header row
        
        // Check required fields per row
        expectedColumns.filter(c => c.required).forEach(col => {
          if (!row[col.name] || row[col.name].trim() === '') {
            currentRowErrs.push({ row: rowNum, msg: `Missing value for "${col.name}"` });
          }
        });

        // Check for internal duplicates (warnings, as backend might skip them anyway)
        if (primaryCol && row[primaryCol]) {
          const val = row[primaryCol].trim().toLowerCase();
          if (seenNames.has(val)) {
            currentWarnings.push({ row: rowNum, msg: `Duplicate entry for "${row[primaryCol]}" within the file` });
          } else {
            seenNames.add(val);
          }
        }
      });
    }

    setHeaders(fileHeaders);
    setParsedData(data);
    
    if (currentFatal.length > 0) {
      setFatalErrors(currentFatal);
      setStep('fatal_error');
    } else {
      setRowErrors(currentRowErrs);
      setWarnings(currentWarnings);
      setStep('preview');
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setStep('importing');
    try {
      const res = await onImport(file);
      setImportResult(res);
      setStep('success');
      onSuccess();
    } catch (err: unknown) {
      setFatalErrors([err instanceof Error ? err.message : 'Unknown error during import']);
      setStep('fatal_error');
    }
  };

  // Check if import is allowed
  const canImport = step === 'preview' && fatalErrors.length === 0 && rowErrors.length === 0;

  return createPortal(
    <div className="modal-overlay fade-in">
      <div className="modal-container" style={{ width: '800px', maxWidth: '90vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        
        {/* Header */}
        <div className="modal-header" style={{ padding: '24px 32px', borderBottom: '1px solid var(--color-border)', position: 'relative' }}>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>{title}</h2>
          <p className="text-muted" style={{ margin: '4px 0 0 0', fontSize: 14 }}>{subtitle}</p>
          <button 
            className="btn btn-ghost" 
            style={{ position: 'absolute', top: 24, right: 24, padding: '4px 12px' }}
            onClick={handleSafeClose}
            disabled={step === 'importing'}
          >
            ✕
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="modal-body" style={{ padding: '32px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* Instruction Panel */}
          {step === 'idle' && (
            <div className="info-note info-note-blue">
              <div style={{ display: 'flex', gap: 12 }}>
                <span style={{ fontSize: 20 }}>ℹ️</span>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: 14, fontWeight: 600 }}>CSV Formatting Requirements</h4>
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
                    Your file must include a header row with exact column names. <br/>
                    <strong>Required columns:</strong> {expectedColumns.filter(c => c.required).map(c => `"${c.name}"`).join(', ')}<br/>
                    <strong>Optional columns:</strong> {expectedColumns.filter(c => !c.required).map(c => `"${c.name}"`).join(', ')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action Cards (Idle state) */}
          {step === 'idle' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Card 1: Template */}
              <div className="card" style={{ border: '1px solid var(--color-border)' }}>
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '32px 24px' }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>📄</div>
                  <h4 style={{ margin: '0 0 8px 0' }}>Need a template?</h4>
                  <p className="text-sm text-muted" style={{ marginBottom: 20 }}>Download a sample CSV file with the correct headers and example data.</p>
                  <button className="btn btn-outline w-full" onClick={onDownloadTemplate}>
                    Download Template
                  </button>
                </div>
              </div>

              {/* Card 2: Upload */}
              <div className="card" style={{ border: '1px dashed var(--color-primary)', backgroundColor: 'var(--color-bg-secondary)' }}>
                <label className="card-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '32px 24px', cursor: 'pointer', height: '100%' }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>📤</div>
                  <h4 style={{ margin: '0 0 8px 0' }}>Upload CSV</h4>
                  <p className="text-sm text-muted" style={{ marginBottom: 20 }}>Click to browse or drag and drop your .csv file here.</p>
                  <div className="btn btn-primary w-full" style={{ pointerEvents: 'none' }}>
                    Select File
                  </div>
                  <input type="file" accept=".csv" style={{ display: 'none' }} ref={fileInputRef} onChange={handleFileChange} />
                </label>
              </div>
            </div>
          )}

          {/* Parsing State */}
          {step === 'parsing' && (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <div className="pulse" style={{ fontSize: 48, marginBottom: 16 }}>⚙️</div>
              <h3 style={{ margin: 0 }}>Reading & Validating CSV...</h3>
              <p className="text-muted" style={{ marginTop: 8 }}>Checking structure and data formats.</p>
            </div>
          )}

          {/* Importing State */}
          {step === 'importing' && (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <div className="pulse" style={{ fontSize: 48, marginBottom: 16 }}>🚀</div>
              <h3 style={{ margin: 0 }}>Importing Data...</h3>
              <p className="text-muted" style={{ marginTop: 8 }}>Please wait while we save these records.</p>
            </div>
          )}

          {/* Success State */}
          {step === 'success' && importResult && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
              <h2 style={{ margin: '0 0 12px 0' }}>Import Successful</h2>
              <div className="info-note info-note-green" style={{ display: 'inline-block', textAlign: 'left', minWidth: 300 }}>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  <li><strong>{importResult.imported}</strong> new records added globally</li>
                  <li><strong>{importResult.skipped}</strong> duplicates skipped safely</li>
                </ul>
              </div>
            </div>
          )}

          {/* Fatal Error State */}
          {step === 'fatal_error' && (
            <div>
              <div className="info-note info-note-amber" style={{ marginBottom: 24 }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>❌</span> Import Blocked due to Structural Errors
                </h4>
                <ul style={{ margin: 0, paddingLeft: 24, fontSize: 14 }}>
                  {fatalErrors.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              </div>
              <div style={{ textAlign: 'center' }}>
                <button className="btn btn-outline" onClick={() => setStep('idle')}>
                  ← Go back and try another file
                </button>
              </div>
            </div>
          )}

          {/* Preview State */}
          {step === 'preview' && (
            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              {/* Validation Summary */}
              {rowErrors.length > 0 ? (
                <div className="info-note info-note-amber">
                  <h4 style={{ margin: '0 0 8px 0' }}>⚠️ Found {rowErrors.length} errors in the file</h4>
                  <ul style={{ margin: 0, paddingLeft: 20, maxHeight: 100, overflowY: 'auto' }}>
                    {rowErrors.map((err, i) => <li key={i}>Row {err.row}: {err.msg}</li>)}
                  </ul>
                  <p style={{ marginTop: 8, marginBottom: 0, fontSize: 13, fontWeight: 600 }}>You must fix these errors in your CSV and re-upload before importing.</p>
                </div>
              ) : warnings.length > 0 ? (
                <div className="info-note info-note-yellow">
                  <h4 style={{ margin: '0 0 8px 0' }}>⚠️ Found {warnings.length} warnings (Import will still work)</h4>
                  <ul style={{ margin: 0, paddingLeft: 20, maxHeight: 80, overflowY: 'auto' }}>
                    {warnings.map((w, i) => <li key={i}>Row {w.row}: {w.msg}</li>)}
                  </ul>
                </div>
              ) : (
                <div className="info-note info-note-green" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 18 }}>✅</span>
                  <div>
                    <h4 style={{ margin: 0 }}>Validation Passed</h4>
                    <p style={{ margin: '4px 0 0 0', fontSize: 13 }}>Found {parsedData.length} valid rows ready to import.</p>
                  </div>
                </div>
              )}

              {/* Preview Table */}
              <div className="card">
                <div className="card-header" style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between' }}>
                  <span className="font-semibold text-sm">Data Preview (First 50 rows)</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => setStep('idle')}>Upload a different file</button>
                </div>
                <div style={{ overflowX: 'auto', maxHeight: '300px' }}>
                  <table className="data-table" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
                    <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--color-bg)' }}>
                      <tr>
                        <th style={{ width: 40, textAlign: 'center' }}>#</th>
                        {headers.map(h => <th key={h}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {parsedData.slice(0, 50).map((row, i) => {
                        const rowNum = i + 2;
                        const hasError = rowErrors.some(e => e.row === rowNum);
                        const hasWarning = warnings.some(w => w.row === rowNum);
                        const rowStyle = hasError ? { backgroundColor: 'rgba(239, 68, 68, 0.05)' } : hasWarning ? { backgroundColor: 'rgba(245, 158, 11, 0.05)' } : {};

                        return (
                          <tr key={i} style={rowStyle}>
                            <td className="text-muted" style={{ textAlign: 'center' }}>{rowNum}</td>
                            {headers.map(h => (
                              <td key={h} style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }} title={row[h]}>
                                {row[h]}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {parsedData.length > 50 && (
                    <div style={{ padding: '12px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
                      ... and {parsedData.length - 50} more rows
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ padding: '16px 32px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: 12, backgroundColor: 'var(--color-bg-secondary)' }}>
          {step !== 'success' && step !== 'importing' && (
            <button className="btn btn-outline" onClick={handleSafeClose}>
              Cancel
            </button>
          )}
          
          {step === 'success' ? (
            <button className="btn btn-primary" onClick={handleSafeClose}>
              Done
            </button>
          ) : step === 'preview' ? (
            <button 
              className="btn btn-primary" 
              onClick={handleImport}
              disabled={!canImport}
              style={{ paddingLeft: 24, paddingRight: 24 }}
            >
              Confirm Import
            </button>
          ) : null}
        </div>

      </div>
    </div>,
    document.body
  );
}
