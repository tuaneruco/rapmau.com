export async function identifyPatternFile(file){
 if(!file||!file.size)throw Error('File rỗng hoặc không đọc được.');
 if(file.size>40*1024*1024)throw Error('File vượt 40 MB.');
 const bytes=new Uint8Array(await file.slice(0,1024).arrayBuffer());const text=new TextDecoder().decode(bytes).replace(/^\uFEFF/,'').trimStart();
 const starts=(values)=>values.every((v,i)=>bytes[i]===v);
 if(new TextDecoder().decode(bytes).includes('%PDF-')){if(file.size>25*1024*1024)throw Error('PDF tối đa 25 MB.');return 'pdf';}
 if(starts([0xff,0xd8,0xff])||starts([137,80,78,71,13,10,26,10])||(text.startsWith('RIFF')&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP')){if(file.size>25*1024*1024)throw Error('Ảnh tối đa 25 MB.');return 'image';}
 if(text.startsWith('{'))return 'pattern';
 throw Error('Chưa hỗ trợ định dạng này. Chọn ảnh JPG/PNG/WebP, PDF hoặc bản rập RAPMAU (.json). DXF/SVG hiện chưa nhập trực tiếp để chỉnh sửa.');
}
