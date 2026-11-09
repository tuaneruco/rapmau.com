const studioState = {
  catalog: null,
  selectedSku: '',
  currentImage: new Image(),
  logoImage: new Image(),
  imageLoaded: false,
  logoLoaded: false
};

studioState.currentImage.crossOrigin = 'anonymous';
studioState.logoImage.crossOrigin = 'anonymous';
studioState.logoImage.src = '/assets/brand/logo-header.png';
studioState.logoImage.onload = () => {
  studioState.logoLoaded = true;
  renderPhotoCanvas();
};

async function initStudio() {
  try {
    let res = await fetch('/api/catalog');
    if (!res.ok) res = await fetch('/data/catalog.json');
    const data = await res.json();
    studioState.catalog = data;
    populateSkuSelect(data.products || []);
  } catch (err) {
    console.error('Lỗi tải catalog trong Studio:', err);
  }

  // Tải ảnh mặc định từ mẫu đầu tiên hoặc ảnh bàn làm việc
  loadPhotoUrl('/assets/brand/hero-workbench.jpg');
  renderSketchCanvas();
  bindStudioEvents();
}

function populateSkuSelect(products) {
  const sel = document.getElementById('skuImageSelect');
  let html = `<option value="">-- Chọn mẫu rập trong kho (258 mẫu) để xử lý ảnh --</option>`;
  for (const p of products) {
    html += `<option value="${p.sku}">[${p.sku}] ${p.title}</option>`;
  }
  sel.innerHTML = html;

  // Nếu URL có ?sku=RM-VI-001 thì tự động chọn
  const params = new URLSearchParams(window.location.search);
  const skuParam = params.get('sku');
  if (skuParam) {
    sel.value = skuParam;
    const found = products.find((x) => x.sku === skuParam);
    if (found && found.images[0]) {
      studioState.selectedSku = found.sku;
      loadPhotoUrl(encodeURI(found.images[0]));
    }
  }
}

function loadPhotoUrl(url) {
  studioState.imageLoaded = false;
  studioState.currentImage.onload = () => {
    studioState.imageLoaded = true;
    renderPhotoCanvas();
  };
  studioState.currentImage.src = url;
}

function renderPhotoCanvas() {
  const canvas = document.getElementById('photoCanvas');
  if (!canvas || !studioState.imageLoaded) return;
  const ctx = canvas.getContext('2d');

  const img = studioState.currentImage;
  const targetW = 900;
  const targetH = Math.round((img.height / img.width) * targetW) || 675;
  canvas.width = targetW;
  canvas.height = Math.min(900, Math.max(480, targetH));

  const bright = Number(document.getElementById('imgBrightRange').value) || 100;
  const contrast = Number(document.getElementById('imgContrastRange').value) || 105;
  const opacity = (Number(document.getElementById('wmOpacityRange').value) || 65) / 100;
  const scale = (Number(document.getElementById('wmScaleRange').value) || 100) / 100;
  const posY = (Number(document.getElementById('wmPosYRange').value) || 58) / 100;
  const style = document.getElementById('watermarkStyleSelect').value;
  const wmText = document.getElementById('watermarkTextInput').value.trim() || 'WWW.RAPMAU.COM';

  document.getElementById('valOpacity').textContent = `${Math.round(opacity * 100)}%`;
  document.getElementById('valScale').textContent = `${Math.round(scale * 100)}%`;
  document.getElementById('valPosY').textContent = `${Math.round(posY * 100)}%`;
  document.getElementById('valBright').textContent = `${bright}%`;
  document.getElementById('valContrast').textContent = `${contrast}%`;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 1. Vẽ ảnh gốc với bộ lọc sáng & tương phản vân da
  ctx.save();
  ctx.filter = `brightness(${bright}%) contrast(${contrast}%)`;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  ctx.restore();

  // 2. Vẽ khung viền chỉ khâu nhẹ chuẩn thương hiệu đồ da
  ctx.save();
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);
  ctx.restore();

  // 3. Áp dụng chế độ In Chìm Logo & Watermark
  ctx.save();
  ctx.globalAlpha = opacity;

  if (style === 'cover_strip') {
    // Dải băng che watermark cũ (rất hữu ích cho các ảnh có chữ cũ ở giữa/dưới ảnh)
    const stripH = Math.round(74 * scale);
    const yCenter = Math.round(canvas.height * posY);
    ctx.fillStyle = 'rgba(28, 19, 12, 0.92)';
    ctx.fillRect(0, yCenter - stripH / 2, canvas.width, stripH);

    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(0, yCenter - stripH / 2 + 5);
    ctx.lineTo(canvas.width, yCenter - stripH / 2 + 5);
    ctx.moveTo(0, yCenter + stripH / 2 - 5);
    ctx.lineTo(canvas.width, yCenter + stripH / 2 - 5);
    ctx.stroke();
    ctx.setLineDash([]);

    if (studioState.logoLoaded) {
      const logoSz = Math.round(52 * scale);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(canvas.width / 2 - 220 * scale, yCenter - logoSz / 2, logoSz, logoSz);
      ctx.drawImage(
        studioState.logoImage,
        canvas.width / 2 - 220 * scale + 3,
        yCenter - logoSz / 2 + 3,
        logoSz - 6,
        logoSz - 6
      );
    }

    ctx.fillStyle = '#fde68a';
    ctx.font = `900 ${Math.round(22 * scale)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(wmText, canvas.width / 2 + 28 * scale, yCenter);
  } else if (style === 'deboss_center') {
    const yCenter = Math.round(canvas.height * posY);
    const boxW = Math.round(440 * scale);
    const boxH = Math.round(110 * scale);
    const xLeft = Math.round((canvas.width - boxW) / 2);
    const yTop = Math.round(yCenter - boxH / 2);

    ctx.fillStyle = 'rgba(35, 22, 13, 0.65)';
    ctx.beginPath();
    ctx.roundRect(xLeft, yTop, boxW, boxH, 14);
    ctx.fill();

    ctx.strokeStyle = 'rgba(253, 230, 138, 0.8)';
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    if (studioState.logoLoaded) {
      const lSz = Math.round(74 * scale);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(xLeft + 18, yCenter - lSz / 2, lSz, lSz, 10);
      ctx.fill();
      ctx.drawImage(studioState.logoImage, xLeft + 22, yCenter - lSz / 2 + 4, lSz - 8, lSz - 8);
    }

    ctx.fillStyle = '#fde68a';
    ctx.font = `900 ${Math.round(21 * scale)}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText('RAPMAU.COM', xLeft + Math.round(108 * scale), yCenter - Math.round(8 * scale));

    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${Math.round(14.5 * scale)}px sans-serif`;
    ctx.fillText(wmText, xLeft + Math.round(108 * scale), yCenter + Math.round(18 * scale));
  } else if (style === 'corner_badge') {
    const boxW = Math.round(330 * scale);
    const boxH = Math.round(68 * scale);
    const xLeft = canvas.width - boxW - 24;
    const yTop = canvas.height - boxH - 24;

    ctx.fillStyle = 'rgba(28, 19, 12, 0.88)';
    ctx.beginPath();
    ctx.roundRect(xLeft, yTop, boxW, boxH, 10);
    ctx.fill();

    if (studioState.logoLoaded) {
      const lSz = Math.round(48 * scale);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(xLeft + 10, yTop + (boxH - lSz) / 2, lSz, lSz);
      ctx.drawImage(studioState.logoImage, xLeft + 12, yTop + (boxH - lSz) / 2 + 2, lSz - 4, lSz - 4);
    }

    ctx.fillStyle = '#fde68a';
    ctx.font = `800 ${Math.round(14 * scale)}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(wmText, xLeft + Math.round(68 * scale), yTop + boxH / 2 + 5);
  } else if (style === 'tiled_diagonal') {
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((-24 * Math.PI) / 180);
    ctx.fillStyle = 'rgba(255, 248, 235, 0.85)';
    ctx.font = `900 ${Math.round(20 * scale)}px sans-serif`;
    ctx.textAlign = 'center';

    const stepX = Math.round(340 * scale);
    const stepY = Math.round(150 * scale);
    for (let x = -canvas.width; x <= canvas.width; x += stepX) {
      for (let y = -canvas.height; y <= canvas.height; y += stepY) {
        ctx.fillText(wmText, x, y);
      }
    }
  }

  ctx.restore();
}

function renderSketchCanvas() {
  const canvas = document.getElementById('sketchCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const title = document.getElementById('sketchTitleInput').value.trim() || 'Chi tiết rập 1:1';
  const widthMm = Math.max(20, Number(document.getElementById('sketchWidthMm').value) || 220);
  const heightMm = Math.max(20, Number(document.getElementById('sketchHeightMm').value) || 95);
  const radiusMm = Math.max(0, Number(document.getElementById('sketchRadiusMm').value) || 6);
  const marginMm = Math.max(1.5, Number(document.getElementById('sketchMarginMm').value) || 3.5);
  const pitchMm = Number(document.getElementById('sketchPitchMm').value) || 3.38;
  const foldType = document.getElementById('sketchFoldLine').value;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 1. Nền bản vẽ kỹ thuật CAD
  ctx.fillStyle = '#fcfaf5';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Lưới milimet quy đổi
  const scalePx = Math.min((canvas.width - 160) / widthMm, (canvas.height - 170) / heightMm);
  const gridStepPx = 10 * scalePx;

  ctx.strokeStyle = '#ece4d5';
  ctx.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += gridStepPx) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += gridStepPx) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  const drawW = widthMm * scalePx;
  const drawH = heightMm * scalePx;
  const startX = (canvas.width - drawW) / 2;
  const startY = (canvas.height - drawH) / 2 + 12;
  const rPx = Math.min(radiusMm * scalePx, drawW / 2, drawH / 2);

  // 2. Đường cắt rập chính (Cut Line)
  ctx.save();
  ctx.fillStyle = 'rgba(217, 119, 6, 0.08)';
  ctx.strokeStyle = '#1e140d';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(startX, startY, drawW, drawH, rPx);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // 3. Đường gấp giữa (Fold Line)
  if (foldType === 'center_v') {
    ctx.save();
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(startX + drawW / 2, startY - 12);
    ctx.lineTo(startX + drawW / 2, startY + drawH + 12);
    ctx.stroke();
    ctx.restore();
  } else if (foldType === 'trifold') {
    ctx.save();
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(startX + drawW / 3, startY - 12);
    ctx.lineTo(startX + drawW / 3, startY + drawH + 12);
    ctx.moveTo(startX + (drawW * 2) / 3, startY - 12);
    ctx.lineTo(startX + (drawW * 2) / 3, startY + drawH + 12);
    ctx.stroke();
    ctx.restore();
  }

  // 4. Đường lấy dấu khâu & Rải lỗ đục tự động theo bước đục (Pitch)
  const mPx = marginMm * scalePx;
  const stitchW = widthMm - marginMm * 2;
  const stitchH = heightMm - marginMm * 2;

  const holesHoriz = Math.max(2, Math.floor(stitchW / pitchMm) + 1);
  const holesVert = Math.max(2, Math.floor(stitchH / pitchMm) + 1);
  const totalHoles = (holesHoriz + holesVert - 2) * 2;

  ctx.save();
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.strokeRect(startX + mPx, startY + mPx, drawW - mPx * 2, drawH - mPx * 2);
  ctx.restore();

  // Vẽ các chấm lỗ đục
  ctx.save();
  ctx.fillStyle = '#b91c1c';
  const innerX = startX + mPx;
  const innerY = startY + mPx;
  const innerW = drawW - mPx * 2;
  const innerH = drawH - mPx * 2;

  for (let i = 0; i < holesHoriz; i++) {
    const x = innerX + (innerW * i) / (holesHoriz - 1);
    ctx.beginPath();
    ctx.arc(x, innerY, 2.3, 0, Math.PI * 2);
    ctx.arc(x, innerY + innerH, 2.3, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let j = 1; j < holesVert - 1; j++) {
    const y = innerY + (innerH * j) / (holesVert - 1);
    ctx.beginPath();
    ctx.arc(innerX, y, 2.3, 0, Math.PI * 2);
    ctx.arc(innerX + innerW, y, 2.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 5. Ghi chú kích thước & Khung tên bản vẽ chuẩn RAPMAU.COM
  ctx.fillStyle = '#1e140d';
  ctx.font = '800 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`BẢN VẼ PHÁC THẢO 1:1 — ${title.toUpperCase()}`, canvas.width / 2, 32);

  ctx.font = '700 13px sans-serif';
  ctx.fillStyle = '#6b5440';
  ctx.fillText(
    `Kích thước cắt: ${widthMm} × ${heightMm} mm • Bo góc R${radiusMm}mm • Biên khâu ${marginMm}mm • Bước đục ${pitchMm}mm (${totalHoles} lỗ)`,
    canvas.width / 2,
    54
  );

  ctx.fillStyle = '#a85418';
  ctx.font = '800 13px sans-serif';
  ctx.fillText(
    'WWW.RAPMAU.COM • HOTLINE/ZALO ĐẶT RẬP MICA & KHUÔN BẾ: 0971.463.768 (MR.TUAN)',
    canvas.width / 2,
    canvas.height - 18
  );

  // Tính định mức da (1 Pia = 30.48 x 30.48 cm = 92903 mm2)
  const areaMm2 = (widthMm + 20) * (heightMm + 20);
  const pia = (areaMm2 / 92903).toFixed(2);

  document.getElementById('sketchStatsSummary').innerHTML = `
    <div>• <strong>Chu vi đường khâu:</strong> ${Math.round((stitchW + stitchH) * 2)} mm (Cần ~${(((stitchW + stitchH) * 2 * 4) / 1000).toFixed(1)}m chỉ sáp)</div>
    <div>• <strong>Tổng số lỗ đục (${pitchMm}mm):</strong> ${totalHoles} lỗ (${holesHoriz} lỗ ngang × ${holesVert} lỗ dọc)</div>
    <div>• <strong>Diện tích da tối thiểu:</strong> ~${pia} Pia (SF)</div>
  `;
}

function bindStudioEvents() {
  // Chuyển Tab Studio
  document.querySelectorAll('#studioMainTabs .st-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#studioMainTabs .st-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.studio-panel').forEach((p) => p.classList.add('hidden'));
      document.getElementById(tab.dataset.panel).classList.remove('hidden');
    });
  });

  // Chọn SKU từ kho 258 mẫu
  document.getElementById('skuImageSelect').addEventListener('change', (e) => {
    const sku = e.target.value;
    studioState.selectedSku = sku;
    const found = (studioState.catalog?.products || []).find((p) => p.sku === sku);
    if (found && found.images[0]) {
      loadPhotoUrl(encodeURI(found.images[0]));
    }
  });

  // Upload ảnh từ máy
  document.getElementById('uploadPhotoInput').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      loadPhotoUrl(ev.target.result);
    };
    reader.readAsDataURL(file);
  });

  // Các thanh trượt xử lý ảnh & in chìm logo
  [
    'watermarkStyleSelect',
    'watermarkTextInput',
    'wmOpacityRange',
    'wmScaleRange',
    'wmPosYRange',
    'imgBrightRange',
    'imgContrastRange'
  ].forEach((id) => {
    document.getElementById(id).addEventListener('input', renderPhotoCanvas);
  });

  // Tải ảnh đã đóng dấu về máy
  document.getElementById('downloadProcessedImgBtn').addEventListener('click', () => {
    const canvas = document.getElementById('photoCanvas');
    const a = document.createElement('a');
    a.download = `${(studioState.selectedSku || 'rapmau-watermarked').toLowerCase()}.jpg`;
    a.href = canvas.toDataURL('image/jpeg', 0.92);
    a.click();
  });

  // Lưu ảnh đã xử lý vào thẳng mã SKU trong catalog.json
  document.getElementById('saveToCatalogSkuBtn').addEventListener('click', async () => {
    if (!studioState.selectedSku) {
      alert('Vui lòng chọn 1 Mã SKU ở mục số 1 để lưu đè ảnh vào sản phẩm đó!');
      return;
    }
    const canvas = document.getElementById('photoCanvas');
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const res = await fetch('/api/save-processed-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sku: studioState.selectedSku,
        dataUrl,
        replacePrimary: true
      })
    });
    const data = await res.json();
    if (data.ok) {
      const st = document.getElementById('studioSaveStatus');
      st.textContent = `✅ Đã lưu ảnh mới có đóng dấu RAPMAU.COM làm ảnh đại diện cho mã ${studioState.selectedSku}!`;
      st.classList.remove('hidden');
    }
  });

  // Sự kiện công cụ Phác Thảo Rập 1:1
  [
    'sketchTitleInput',
    'sketchWidthMm',
    'sketchHeightMm',
    'sketchRadiusMm',
    'sketchMarginMm',
    'sketchPitchMm',
    'sketchFoldLine'
  ].forEach((id) => {
    document.getElementById(id).addEventListener('input', renderSketchCanvas);
  });

  document.getElementById('downloadSketchPngBtn').addEventListener('click', () => {
    const canvas = document.getElementById('sketchCanvas');
    const a = document.createElement('a');
    a.download = 'ban-ve-phac-thao-rapmau.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
  });

  document.getElementById('sendSketchToMrTuanBtn').addEventListener('click', async () => {
    const title = document.getElementById('sketchTitleInput').value.trim();
    const w = document.getElementById('sketchWidthMm').value;
    const h = document.getElementById('sketchHeightMm').value;
    const pitch = document.getElementById('sketchPitchMm').value;
    window.open(
      `https://zalo.me/0971463768`,
      '_blank'
    );
    alert(`Đã mở Zalo Mr.Tuan (0971.463.768)! Bạn có thể gửi ảnh bản vẽ vừa tải kèm thông số: ${title} (${w}x${h}mm, bước đục ${pitch}mm).`);
  });

  // Mở công cụ tùy chỉnh trong iframe
  document.getElementById('loadCustomToolBtn').addEventListener('click', () => {
    const url = document.getElementById('customToolUrlInput').value.trim();
    if (url) {
      document.getElementById('customToolIframe').src = url;
    }
  });
}

initStudio();
