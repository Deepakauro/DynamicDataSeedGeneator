// Minimal CSV parser that handles commas inside quotes, trims, etc.
function parseCsv(text) {
  const rows = [];
  const lines = text.split('\n').filter(l => l.trim() !== '');
  const regex = /("([^"]|"")*"|[^,]+)(,|$)/g;

  for (const line of lines) {
    const values = [];
    let match;
    let str = line.trim();
    while ((match = regex.exec(str)) !== null) {
      let val = match[1];
      val = val.trim();
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1).replace(/""/g, '"');
      }
      values.push(val);
    }
    rows.push(values);
  }
  return rows;
}

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

  const propertyRegex = /public\s+([A-Za-z0-9_<>\[\]]+)\s+([A-Za-z0-9_]+)\s*\{\s*get;\s*set;\s*\}/g;
  properties = [];
  let match;
  while ((match = propertyRegex.exec(content)) !== null) {
    const [, type, name] = match;
    properties.push({ type: type.trim(), name: name.trim() });
  }

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
    case 'string[]': return 'Red|Blue|Green';
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
      case 'guid': note = 'Enter a valid Guid string'; break;
      case 'string[]':
        const parts = raw.split(',').map(p => `"${p.trim()}"`);
        value = `new string[] { ${parts.join(', ')} }`;
        break;
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
    const rows = parseCsv(text);

    if (rows.length < 2) return alert('CSV must contain headers and at least one data row.');

    const headers = rows[0];
    const dataRows = rows.slice(1);

    let csharp = `public static List<${entityName}> SeedData => new List<${entityName}>\n{\n`;

    for (const row of dataRows) {
      const valueMap = {};
      headers.forEach((h, i) => {
        valueMap[h.trim()] = row[i]?.trim() ?? '';
      });

      const idValue = valueMap['Id'];
      if (!idValue) {
        alert('Missing Id in a CSV row. Each row must include a valid Id.');
        return;
      }

      function generateCSharpObject(entityName, fields) {
  let csharp = `    new ${entityName} {\n`;

  for (const [key, value] of Object.entries(fields)) {
    let line = `        ${key} = `;

    if (typeof value === 'string') {
      const lowerVal = value.toLowerCase().trim();

      if (lowerVal === 'true' || lowerVal === 'false') {
        line += `${lowerVal},`;
      } else if (lowerVal.startsWith('new guid')) {
        line += `${value.trim()},`;
      } else if (/^[0-9a-f-]{36}$/i.test(value.trim())) {
        // value looks like a raw Guid
        line += `new Guid("${value.trim()}"),`;
      } else {
        // treat as string
        line += `"${value.trim()}",`;
      }
    } else if (typeof value === 'number') {
      line += `${value},`;
    } else {
      // fallback: stringify everything else
      line += `${JSON.stringify(value)},`;
    }

    csharp += line + '\n';
  }

  csharp += `    },\n`;
  return csharp;
}


      for (const prop of properties) {
        if (['Id', 'IsActive'].includes(prop.name)) continue;

        const raw = valueMap[prop.name] ?? '';
        let value = '';

        switch (prop.type.toLowerCase()) {
          case 'int':
          case 'int32':
            value = parseInt(raw) || 0;
            break;
          case 'bool':
          case 'boolean':
            value = raw.toLowerCase() === 'true' ? 'true' : 'false';
            break;
          case 'string[]':
            const parts = raw.split('|').map(p => `"${p.trim()}"`);
            value = `new string[] { ${parts.join(', ')} }`;
            break;
          case 'string':
          default:
            value = `"${raw}"`;
        }

        csharp += `        ${prop.name} = ${value},\n`;
      }

      csharp += `    },\n`;
    }

    csharp += `};`;
    document.getElementById('csharpOutput').textContent = csharp;
  };

  reader.readAsText(file);
}
