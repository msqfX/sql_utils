// Global state
let currentExcelData = null;
let currentSheetName = null;
let parsedSqlData = null;

function switchTab(tabId) {
  // Update tab buttons
  document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
  event.target.classList.add('active');

  // Show/hide panels
  document.getElementById('excel2sql-panel').style.display = tabId === 'excel2sql' ? 'block' : 'none';
  document.getElementById('sql2excel-panel').style.display = tabId === 'sql2excel' ? 'block' : 'none';
}

async function selectExcelFile() {
  const result = await window.electronAPI.showOpenDialog();
  if (result.canceled || !result.filePaths[0]) return;

  const filePath = result.filePaths[0];
  const fileName = filePath.split('/').pop();

  try {
    const workbook = await window.electronAPI.readExcel(filePath);
    currentExcelData = workbook;
    currentSheetName = Object.keys(workbook)[0];

    document.getElementById('excel-info').style.display = 'block';
    document.getElementById('excel-info').innerHTML = `<span class="name">${fileName}</span> - 包含 ${Object.keys(workbook).length} 个工作表，当前: ${currentSheetName}`;

    showExcelPreview();
  } catch (error) {
    alert('读取文件失败: ' + error.message);
  }
}

function showExcelPreview() {
  if (!currentExcelData || !currentSheetName) return;

  const sheetData = currentExcelData[currentSheetName];
  if (!sheetData || sheetData.length === 0) return;

  const headers = sheetData[0];
  const rows = sheetData.slice(1, 6); // Show first 5 rows

  let tableHTML = '<table><tr>';
  headers.forEach(h => tableHTML += `<th>${escapeHtml(h || '')}</th>`);
  tableHTML += '</tr>';

  rows.forEach(row => {
    tableHTML += '<tr>';
    headers.forEach((h, i) => tableHTML += `<td>${escapeHtml(row[i] || '')}</td>`);
    tableHTML += '</tr>';
  });
  tableHTML += '</table>';

  if (sheetData.length > 6) {
    tableHTML += `<p style="margin-top:10px;color:#666;">... 还有 ${sheetData.length - 6} 行数据</p>`;
  }

  document.getElementById('excel-preview').style.display = 'block';
  document.getElementById('excel-preview').innerHTML = tableHTML;
}

function excelToSql() {
  if (!currentExcelData || !currentSheetName) {
    alert('请先选择 Excel 文件');
    return;
  }

  const tableName = document.getElementById('tableName').value.trim();
  if (!tableName) {
    alert('请输入表名');
    return;
  }

  const sqlType = document.querySelector('input[name="sqlType"]:checked').value;
  const sheetData = currentExcelData[currentSheetName];

  if (sheetData.length < 2) {
    alert('Excel 文件中没有数据');
    return;
  }

  const headers = sheetData[0];
  const rows = sheetData.slice(1);
  const output = [];

  rows.forEach(row => {
    const values = row.map((cell, i) => {
      if (cell === null || cell === undefined) return 'NULL';
      const val = String(cell);
      // Escape single quotes and handle special values
      if (val.toUpperCase() === 'NULL') return 'NULL';
      return "'" + val.replace(/'/g, "''") + "'";
    });

    if (sqlType === 'INSERT') {
      output.push(`INSERT INTO ${tableName} (${headers.join(', ')}) VALUES (${values.join(', ')});`);
    } else if (sqlType === 'UPDATE') {
      // UPDATE requires WHERE clause - using first column as identifier
      const sets = headers.map((h, i) => `${h} = ${values[i]}`).join(', ');
      const whereCol = headers[0];
      const whereVal = row[0];
      output.push(`UPDATE ${tableName} SET ${sets} WHERE ${whereCol} = '${whereVal}';`);
    } else if (sqlType === 'DELETE') {
      // DELETE - using first column as identifier
      const whereCol = headers[0];
      const whereVal = row[0];
      output.push(`DELETE FROM ${tableName} WHERE ${whereCol} = '${whereVal}';`);
    }
  });

  document.getElementById('excel-output').value = output.join('\n');
}

async function saveSql() {
  const sql = document.getElementById('excel-output').value;
  if (!sql.trim()) {
    alert('没有可保存的 SQL');
    return;
  }

  const result = await window.electronAPI.showSaveDialog('export.sql');
  if (result.canceled || !result.filePath) return;

  try {
    const fs = require('fs');
    fs.writeFileSync(result.filePath, sql, 'utf8');
    alert('SQL 文件已保存到: ' + result.filePath);
  } catch (error) {
    alert('保存失败: ' + error.message);
  }
}

function copySql() {
  const sql = document.getElementById('excel-output').value;
  if (!sql.trim()) {
    alert('没有可复制的内容');
    return;
  }
  navigator.clipboard.writeText(sql).then(() => {
    alert('已复制到剪贴板');
  });
}

function sqlToExcel() {
  const sqlText = document.getElementById('sql-input').value.trim();
  if (!sqlText) {
    alert('请输入 SQL 语句');
    return;
  }

  // Parse INSERT INTO statements
  const insertRegex = /INSERT\s+INTO\s+([^\s\(]+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/gi;
  const records = [];
  let match;

  while ((match = insertRegex.exec(sqlText)) !== null) {
    const tableName = match[1].trim();
    const columns = match[2].split(',').map(c => c.trim());
    const values = match[3].split(',').map(v => parseValue(v.trim()));

    records.push({ table: tableName, columns, values });
  }

  if (records.length === 0) {
    alert('未找到有效的 INSERT 语句');
    return;
  }

  // Use first record's columns
  const columns = records[0].columns;
  const data = records.map(r => {
    const row = {};
    columns.forEach((col, i) => {
      row[col] = r.values[i];
    });
    return row;
  });

  parsedSqlData = { columns, data };

  // Show preview
  let tableHTML = '<table><tr>';
  columns.forEach(c => tableHTML += `<th>${escapeHtml(c)}</th>`);
  tableHTML += '</tr>';

  data.slice(0, 10).forEach(row => {
    tableHTML += '<tr>';
    columns.forEach(c => tableHTML += `<td>${escapeHtml(String(row[c] || ''))}</td>`);
    tableHTML += '</tr>';
  });
  tableHTML += '</table>';

  if (data.length > 10) {
    tableHTML += `<p style="margin-top:10px;color:#666;">... 共 ${data.length} 条记录</p>`;
  }

  document.getElementById('sql-preview').style.display = 'block';
  document.getElementById('sql-preview').innerHTML = tableHTML;
}

function parseValue(val) {
  if (val === 'NULL') return null;
  // Remove surrounding quotes
  if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
    return val.slice(1, -1);
  }
  return val;
}

async function exportExcel() {
  if (!parsedSqlData) {
    alert('请先解析 SQL');
    return;
  }

  const result = await window.electronAPI.showSaveDialog('export.xlsx');
  if (result.canceled || !result.filePath) return;

  try {
    await window.electronAPI.writeExcel(parsedSqlData.data, result.filePath);
    alert('Excel 文件已导出到: ' + result.filePath);
  } catch (error) {
    alert('导出失败: ' + error.message);
  }
}

function clearSql() {
  document.getElementById('sql-input').value = '';
  document.getElementById('sql-preview').style.display = 'none';
  parsedSqlData = null;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}