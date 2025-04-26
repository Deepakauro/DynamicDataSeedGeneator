let properties = [];

window.addEventListener('DOMContentLoaded', () => {
  const savedProps = sessionStorage.getItem('entityProperties');
  const savedName = sessionStorage.getItem('entityName');

  if (savedProps) {
    properties = JSON.parse(savedProps);
    document.getElementById('entityName').value = savedName || 'YourEntity';
    showTips();
  }
});

document.getElementById('entityFileInput').addEventListener('change', function (e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (event) {
    const content = event.target.result;
    parseEntity(content);
  };
  reader.readAsText(file);
});

function parseEntity(content) {
  const classNameMatch = content.match(/public\s+class\s+([A-Za-z0-9_]+)/);
  const className = classNameMatch ? classNameMatch[1] : 'YourEntity';
  document.getElementById('entityName').value = className;

  const propertyRegex = /public\s+([A-Za-z0-9<>]+)\s+([A-Za-z0-9_]+)\s*\{\s*get;\s*set;\s*\}/g;
  properties = [];
  let match;
  while ((match = propertyRegex.exec(content)) !== null) {
    const [, type, name] = match;
    properties.push({ type, name });
  }

  // Save for reuse
  sessionStorage.setItem('entityProperties', JSON.stringify(properties));
  sessionStorage.setItem('entityName', className);

  showTips();
}

function getSampleValue(type) {
  switch (type.toLowerCase()) {
    case 'string': return 'Sample Text';
    case 'int':
    case 'int32': return '1';
    case 'bool':
    case 'boolean': return 'true';
    case 'guid': return '';
    default: return '';
  }
}

function showTips() {
  let tips = `<strong>Field Format Suggestions:</strong><ul>`;
  for (const prop of properties) {
    let note = '';
    switch (prop.type.toLowerCase()) {
      case 'string': note = 'Any text (e.g. "John Doe")'; break;
      case 'int':
      case 'int32': note = 'Integer (e.g. 1, 100)'; break;
      case 'bool':
      case 'boolean': note = 'true / false'; break;
      case 'guid': note = 'Leave blank to auto-generate Guid'; break;
      default: note = 'Custom type'; break;
    }
    tips += `<li><strong>${prop.name}</strong> (${prop.type}) – ${note}</li>`;
  }
  tips += `</ul>`;
  document.getElementById('formatTips').innerHTML = tips;
}

function downloadCsv() {
  if (!properties.length) return alert('Upload a C# entity first.');

  const headers = properties.map(p => p.name).join(',');
  const sampleRow = properties.map(p => getSampleValue(p.type)).join(',');
  const csv = `${headers}\n${sampleRow}`;

  const blob = new Blob([csv], { type: 'text/csv' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'sample_entity_data.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function generateCSharp() {
  const file = document.getElementById('csvFileInput').files[0];
  const entityName = document.getElementById('entityName').value.trim() || 'YourEntity';

  if (!file || !properties.length) return alert('Make sure both CSV and Entity file are loaded.');

  const reader = new FileReader();
  reader.onload = function (e) {
    const text = e.target.result.trim();
    const lines = text.split('\n');
    const headers = lines[0].split(',');
    const rows = lines.slice(1);

    let csharp = `public static List<${entityName}> SeedData => new List<${entityName}>\n{\n`;

    for (const row of rows) {
      const values = row.split(',');
      csharp += `    new ${entityName} {\n`;

      csharp += `        Id = Guid.NewGuid(),\n`;
      csharp += `        IsActive = true,\n`;

      headers.forEach((header, i) => {
        const prop = properties.find(p => p.name === header.trim());
        if (!prop || prop.name === 'Id' || prop.name === 'IsActive') return;

        let value = values[i]?.trim() ?? '';
        if (['int', 'int32'].includes(prop.type.toLowerCase())) {
          value = parseInt(value) || 0;
        } else if (['bool', 'boolean'].includes(prop.type.toLowerCase())) {
          value = value.toLowerCase() === 'true' ? 'true' : 'false';
        } else {
          value = `"${value}"`;
        }
        csharp += `        ${prop.name} = ${value},\n`;
      });

      csharp += `    },\n`;
    }

    csharp += `};`;

    document.getElementById('csharpOutput').textContent = csharp;
  };

  reader.readAsText(file);
}
