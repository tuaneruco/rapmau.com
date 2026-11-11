'use strict';
(function(root){
 const round=n=>Math.round(n*10)/10;
 function suggest(type,width,height){
  const w=Number(width),h=Number(height);
  if(!(w>=10&&w<=1500&&h>=10&&h<=1500))throw Error('Nhập chiều rộng và chiều cao thành phẩm từ 10 đến 1500 mm.');
  const p=(name,a,b,quantity,shape,reason)=>({name,widthMm:round(a),heightMm:round(b),quantity,shape:shape||'rect',reason,confidence:'inferred'});
  let pieces,notes=['Các số đo là gợi ý ban đầu, chưa cộng bù độ dày da, đường may, mép gập và hao hụt khi cắt.','Kiểm tra mặt sau, độ sâu ngăn, tâm nút, bán kính góc và thứ tự lắp ráp trên mẫu thật.'];
  switch(type){
   case 'vi-cuc': pieces=[p('Thân ngoài',w*2.05,h,1,'rect','Giả định thân gập đôi, cộng khoảng hở gáy 5% chiều rộng.'),p('Nắp gập',w*.95,h*.46,1,'flap','Cần đối chiếu góc nắp và điểm đặt nút trên ảnh.'),p('Ngăn trong',w*.92,h*.80,2,'rect','Hai ngăn trong là cấu trúc thường gặp; kiểm tra mặt trong thật.'),p('Miếng gia cố nút',w*.25,h*.22,2,'rect','Tùy vật liệu và loại nút, có thể không cần.')];break;
   case 'vi-giay-to': pieces=[p('Bìa ngoài',w*2.05,h,1,'rect','Giả định ví gập đôi, chừa phần gáy 5% chiều rộng.'),p('Tấm lót bên trái',w*.92,h*.94,1,'rect','Cần kiểm tra độ dày giấy tờ và khoảng chừa mép.'),p('Tấm lót bên phải',w*.92,h*.94,1,'rect','Cần kiểm tra kiểu ngăn thật.'),p('Ngăn giấy tờ',w*.86,h*.54,2,'rect','Số ngăn và miệng mở cần xác nhận.')];break;
   case 'bao-kinh': pieces=[p('Thân trước',w,h,1,'rect','Kích thước theo mặt ngoài nhập vào.'),p('Thân sau và nắp',w,h*1.48,1,'flap','Phần nắp ước lượng 48% chiều cao; cần đo kính thật.'),p('Nẹp hông',h*1.8,w*.12,1,'rect','Chỉ dùng khi bao có hông; kiểm tra ảnh cạnh.')];break;
   case 'tui': pieces=[p('Thân trước',w,h,1,'rect','Mặt trước sản phẩm.'),p('Thân sau',w,h,1,'rect','Mặt sau cần xác nhận.'),p('Nắp',w*.96,h*.42,1,'flap','Chỉ dùng nếu sản phẩm có nắp; kiểm tra thực tế.'),p('Dải hông/đáy',h*2+w,w*.12,1,'rect','Giả định chiều sâu khoảng 12% chiều rộng; cần đo mặt cạnh.')];break;
   case 'day-nit': pieces=[p('Dải dây chính',w,h,1,'rect','Với dây nịt, nhập chiều dài thành phẩm vào ô Rộng và bản dây vào ô Cao.'),p('Miếng gia cố đầu khóa',h*2.5,h,1,'rect','Phụ thuộc loại khóa, có thể không cần.'),p('Đai giữ dây',h*2.6,h*.65,1,'rect','Đối chiếu bản dây và độ dày da.')];notes.push('Đo độ dài từ chốt khóa đến lỗ sử dụng; nhập chiều dài và bản rộng theo đúng hướng trước khi tạo rập.');break;
   default: pieces=[p('Thân chính',w,h,1,'rect','Chỉ phác hình bao ngoài. Cần xác định cấu trúc từ ảnh và mẫu thật.')];notes.push('Chọn đúng dòng sản phẩm để nhận danh sách chi tiết phù hợp hơn.');
  }
  return {source:'reference',category:type,summary:'Bộ gợi ý cấu tạo theo loại sản phẩm và kích thước bạn nhập. Chưa phải kết quả nhận diện ảnh bằng AI.',notes,pieces};
 }
 root.patternSuggest={suggest};
})(globalThis);
