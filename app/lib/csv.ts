export const importHeaders=['name','email','role','store','trainer_email','hire'];
export function parseMembersCSV(input:string){
 const s=input.replace(/^\uFEFF/,''),rows:string[][]=[];let row:string[]=[],cell='',quoted=false,closed=false;
 const push=()=>{row.push(cell);cell='';closed=false};const end=()=>{push();if(row.some(x=>x.trim()))rows.push(row);row=[]};
 for(let i=0;i<s.length;i++){const c=s[i];if(quoted){if(c==='"'){if(s[i+1]==='"'){cell+='"';i++}else{quoted=false;closed=true}}else cell+=c;continue}
  if(c==='"'){if(cell||closed)throw Error('CSV_INVALID');quoted=true}else if(c===',')push();else if(c==='\n'||c==='\r'){if(c==='\r'&&s[i+1]==='\n')i++;end()}else{if(closed&&c.trim())throw Error('CSV_INVALID');if(!closed)cell+=c}}
 if(quoted)throw Error('CSV_INVALID');end();if(rows.length<2)throw Error('CSV_EMPTY');const header=rows.shift()!.map(x=>x.trim());if(header.length!==6||new Set(header).size!==6||importHeaders.some(k=>!header.includes(k)))throw Error('CSV_HEADERS');
 if(rows.length>50)throw Error('IMPORT_LIMIT');return rows.map((r,i)=>{if(r.length!==6)throw Error('CSV_ROW_'+(i+2));return Object.fromEntries(header.map((k,j)=>[k,r[j].trim()]))});
}
