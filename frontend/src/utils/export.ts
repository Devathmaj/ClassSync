export function downloadCSV(filename: string, headers: string[], data: any[][]) {
  if (!data) return;

  const csvRows = [];
  
  // Add headers
  csvRows.push(headers.map(h => escapeCSV(h)).join(','));
  
  // Add data rows
  for (const row of data) {
    const rowValues = row.map(val => escapeCSV(val));
    csvRows.push(rowValues.join(','));
  }
  
  const csvContent = csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function escapeCSV(val: any): string {
  if (val === null || val === undefined) {
    return '';
  }
  let str = val.toString();
  // If the string contains a comma, quote, or newline, it must be quoted
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    // Escape existing quotes by doubling them
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
