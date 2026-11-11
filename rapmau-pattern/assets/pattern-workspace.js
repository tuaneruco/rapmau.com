'use strict';
(()=>{
 const $=id=>document.getElementById(id),layout=document.querySelector('.layout'),workspace=document.querySelector('.workspace'),side=document.querySelector('.side');
 document.body.classList.add('pattern-workbench');
 const make=(tag,cls,text)=>{const e=document.createElement(tag);e.className=cls;if(text)e.textContent=text;return e};
 const button=(text,fn)=>{const b=make('button','',text);b.type='button';b.onclick=fn;return b};
 const dock=make('aside','pattern-inspector');dock.setAttribute('aria-label','Thuộc tính chi tiết');layout.append(dock);
 const head=make('div','panel-title','Thuộc tính chi tiết');head.append(button('Đóng',()=>toggle('right',false)));dock.append(head);
 const inputFold=make('details','pattern-input-fold');inputFold.open=true;inputFold.append(make('summary','','Nhập ảnh / PDF & công cụ'));
 while(side.firstChild)inputFold.append(side.firstChild);side.append(inputFold);
 const list=make('section','pattern-piece-panel');list.append(make('h2','','Chi tiết bản vẽ'));side.append(list);list.append($('pieceList'));
 const tiny=make('details','pattern-tiny');tiny.id='tinyPieceGroup';tiny.append(make('summary','','Nét nhỏ cần kiểm tra'),make('div','pattern-tiny-list'));list.append(tiny);
 const listActions=make('div','pattern-list-actions');for(const id of ['nextPiece','togglePrevious','clearPieceSelection'])listActions.append($(id));list.append(listActions);
 const actions=document.querySelector('.stage-actions');dock.append(actions);
 const footer=make('div','pattern-transfer');footer.append($('stageToPaper'));workspace.append(footer);footer.append($('status'));$('stageSelected').hidden=true;
 const transferControls=make('div','pattern-transfer-controls');footer.prepend(transferControls);
 const scopeLabel=make('label','','Đưa lên giấy '),scope=document.createElement('select');scope.id='transferScope';
 for(const [value,text] of [['active','Chi tiết đang xem'],['selected','Các chi tiết đã tích'],['all','Tất cả chi tiết đã nhập']]){const o=new Option(text,value);scope.add(o)}scopeLabel.append(scope);
 const behaviorLabel=make('label','','Bố trí '),behavior=document.createElement('select');behavior.id='transferBehavior';behavior.add(new Option('Thêm / cập nhật vào giấy hiện tại','append'));behavior.add(new Option('Chỉ giữ nhóm này trên giấy','replace'));behaviorLabel.append(behavior);
 const pick=button('☷ Chọn chi tiết',()=>{if(document.body.classList.contains('drawing-focus'))$('quickFullscreen').click();inputFold.open=false;toggle('left',true);list.scrollIntoView({block:'nearest'});});
 const summary=make('span','pattern-transfer-summary');summary.setAttribute('role','status');
 transferControls.append(pick,scopeLabel,behaviorLabel,$('stageToPaper'),summary);
 const selectActions=make('div','pattern-selection-actions');
 selectActions.append(button('Chọn tất cả đã nhập',()=>{chosenPieces=new Set(pieces.flatMap((p,i)=>p.points.length?[i]:[]));scope.value='selected';syncPiece()}),button('Chỉ chi tiết đang xem',()=>{chosenPieces=new Set([active]);scope.value='selected';syncPiece()}));list.insertBefore(selectActions,$('pieceList'));
 const selectionHint=make('p','hint','Tích ô để chọn nhiều. “Tất cả” gồm các trang PDF đã nhập. Đường chưa khép kín cần sửa trước khi lên giấy.');list.insertBefore(selectionHint,$('pieceList'));
 const finder=make('div','pattern-piece-finder'),search=document.createElement('input');search.type='search';search.placeholder='Tìm chi tiết theo tên…';search.setAttribute('aria-label','Tìm chi tiết trong trang đang xem');
 const filterCount=make('small','');finder.append(search,filterCount);list.insertBefore(finder,$('pieceList'));
 const normalize=value=>value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d');
 function filterPieces(){const query=normalize(search.value.trim()),rows=[...list.querySelectorAll('.piece-chip-wrap')];let found=0;for(const row of rows){const matches=normalize(row.querySelector('.piece-chip')?.textContent||'').includes(query);row.hidden=!matches;if(matches)found++}filterCount.textContent=query?`${found} / ${rows.length} chi tiết trong trang này`:'Tìm không làm thay đổi các ô đã tích';if(query&&tiny.querySelector('.piece-chip-wrap:not([hidden])'))tiny.open=true;}
 search.oninput=filterPieces;

 let lastSelection=null;
 function syncTransfer(){const key=[...chosenPieces].sort((a,b)=>a-b).join(',');if(lastSelection!==null&&lastSelection!==key)scope.value='selected';lastSelection=key;const count=scope.value==='all'?pieces.filter(p=>p.points.length).length:scope.value==='selected'?chosenPieces.size:pieces[active]?.points.length?1:0;const onPaper=staged?.pieces.length||0;$('stageToPaper').textContent=`Đưa ${count} chi tiết lên giấy →`;$('stageToPaper').disabled=!count;summary.textContent=`${chosenPieces.size} đã tích · ${onPaper} trên giấy · Xuất toàn bộ giấy`;summary.title='Muốn xuất riêng một nhóm: chọn nhóm đó rồi chọn Chỉ giữ nhóm này trên giấy.';}
 scope.onchange=syncTransfer;behavior.onchange=syncTransfer;
 list.addEventListener('change',e=>{if(e.target.matches('input[type=checkbox]')){scope.value='selected';syncTransfer()}});
 $('clearPieceSelection').addEventListener('click',()=>{scope.value='selected';syncTransfer()});
 $('stageToPaper').onclick=()=>{stagePieces(true,{scope:scope.value,replace:behavior.value==='replace'});syncTransfer()};
 const transferDialog=make('dialog','pattern-transfer-dialog');transferDialog.setAttribute('aria-labelledby','transferDialogTitle');
 const transferTitle=make('h2','','Đưa chi tiết lên giấy');transferTitle.id='transferDialogTitle';
 const transferFeedback=make('p','pattern-transfer-feedback');transferFeedback.setAttribute('role','status');
 const transferPaperLabel=make('label','','Khổ giấy & chiều giấy'),transferPaper=document.createElement('select');transferPaper.id='transferPaperPreset';transferPaper.setAttribute('aria-label','Khổ giấy khi đưa chi tiết lên giấy');
 for(const option of $('paperPreset').options)transferPaper.append(option.cloneNode(true));
 transferPaperLabel.append(transferPaper);transferControls.insertBefore(transferPaperLabel,$('stageToPaper'));
 transferPaper.onchange=()=>{setPaperPreset(transferPaper.value);syncTransfer();transferFeedback.textContent='Đã chọn '+transferPaper.selectedOptions[0].textContent+'. Bấm Đưa chi tiết lên giấy để kiểm tra và bố trí lại.';};
 const closeTransfer=button('Quay lại vùng vẽ',()=>transferDialog.close());
 transferDialog.append(transferTitle,make('p','hint','Chọn phạm vi và cách bố trí. Tệp xuất sẽ gồm toàn bộ chi tiết đang nằm trên giấy.'),transferControls,transferFeedback,closeTransfer);document.body.append(transferDialog);
 footer.prepend(pick);footer.append(summary);
 const launchTransfer=button('Đưa lên giấy…',()=>{syncTransfer();transferPaper.value=$('paperPreset').value;transferFeedback.textContent='';transferDialog.showModal();scope.focus()});launchTransfer.className='primary';footer.insertBefore(launchTransfer,summary);
 const openPaper=button('Xem giấy in',()=>{if(staged){showWorkspace('paper');setPaneMode('paper');}});footer.insertBefore(openPaper,summary);footer.append($('status'));
 transferDialog.addEventListener('close',()=>launchTransfer.focus());
 $('stageToPaper').onclick=()=>{const before=staged;stagePieces(true,{scope:scope.value,replace:behavior.value==='replace'});syncTransfer();if(staged!==before){transferDialog.close();toggle('left',false);toggle('right',false);setPaneMode('split');$('paperPreview').focus({preventScroll:true})}else transferFeedback.textContent=$('validationMessage').classList.contains('problem')?$('validationMessage').textContent:$('status').textContent;};


 // Keep secondary drawing commands accessible without expanding the main toolbar.
 const quick=document.querySelector('.quick-bar'),more=make('details','pattern-more'),moreBody=make('div','pattern-more-body');more.append(make('summary','','Thêm công cụ ▾'),moreBody);
 const keep=new Set(['quickMovePiece','quickEdit','quickPencil','quickPen','quickPan','quickText','quickUndo','quickRedo','quickFullscreen']);
 for(const e of [...quick.children]){if(!keep.has(e.id)&&!e.classList.contains('quick-shapes'))moreBody.append(e)}quick.append(more);
 const panelShortcuts=make('div','pattern-panel-shortcuts');
 function openPanel(which){if(document.body.classList.contains('drawing-focus'))$('quickFullscreen').click();if(which==='left')inputFold.open=false;toggle(which);}
 const piecesButton=button('☷ Chi tiết',()=>openPanel('left')),propertiesButton=button('⚙ Thuộc tính',()=>openPanel('right'));
 piecesButton.setAttribute('aria-controls','patternSourcePanel');propertiesButton.setAttribute('aria-controls','patternPropertyPanel');panelShortcuts.append(piecesButton,propertiesButton);quick.append(panelShortcuts);

 const nav=make('nav','pattern-steps');nav.setAttribute('aria-label','Các bước làm rập');
 const steps=[button('① Nhập & kiểm tra',()=>{inputFold.open=true;$('railPdf').click();setPaneMode('split');toggle('left',true)}),button('② Chỉnh rập',()=>{$('editTab').click();setPaneMode('split');inputFold.open=false}),button('③ Xếp giấy & xuất',()=>{if($('paperTab').disabled){$('status').textContent='Chọn chi tiết và bấm Đưa / cập nhật lên giấy trước.';return}$('paperTab').click();setPaneMode('split')})];
 steps.forEach(b=>nav.append(b));const leftToggle=button('☷ Chi tiết',()=>toggle('left')),rightToggle=button('⚙ Thuộc tính',()=>toggle('right'));side.id='patternSourcePanel';dock.id='patternPropertyPanel';leftToggle.setAttribute('aria-controls',side.id);rightToggle.setAttribute('aria-controls',dock.id);nav.append(leftToggle,rightToggle);workspace.prepend(nav);
 const backdrop=button('Đóng bảng điều khiển',()=>{toggle('left',false);toggle('right',false)});backdrop.className='pattern-panel-backdrop';backdrop.hidden=true;layout.append(backdrop);
 const drawing=make('div','pattern-drawing-tools');drawing.setAttribute('aria-label','Công cụ vẽ');document.querySelector('.app-rail').append(drawing);
 for(const [id,icon,label] of [['quickMovePiece','↖','Di chuyển'],['quickEdit','◇','Chỉnh điểm'],['quickPen','✒','Bút Pen'],['quickPencil','✎','Vẽ tự do'],['quickPan','✥','Bàn tay'],['quickText','T','Thêm chữ']]){const b=$(id);b.title=label;b.setAttribute('aria-label',label);b.replaceChildren(make('span','',icon),make('small','',label));drawing.append(b)}
 moreBody.append(quick.querySelector('.quick-shapes'));const hint=$('toolHint');hint.classList.add('pattern-context-hint');quick.append(hint);new MutationObserver(()=>hint.title=hint.textContent).observe(hint,{childList:true,characterData:true,subtree:true});
 let panelOpener=null;
 function panelState(){const left=!document.body.classList.contains('hide-pattern-left'),right=!document.body.classList.contains('hide-pattern-right');leftToggle.setAttribute('aria-expanded',String(left));rightToggle.setAttribute('aria-expanded',String(right));piecesButton.setAttribute('aria-expanded',String(left));propertiesButton.setAttribute('aria-expanded',String(right));backdrop.hidden=innerWidth>=1100||!(left||right);}
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!backdrop.hidden){toggle('left',false);toggle('right',false);panelOpener?.focus();}});
 document.addEventListener('click',e=>{for(const d of [more])if(d.open&&!d.contains(e.target))d.open=false;});

 function toggle(which,force){const cls=which==='left'?'hide-pattern-left':'hide-pattern-right';const hide=force===undefined?!document.body.classList.contains(cls):!force;if(!hide)panelOpener=document.activeElement;document.body.classList.toggle(cls,hide);if(!hide&&innerWidth<1100)document.body.classList.add(which==='left'?'hide-pattern-right':'hide-pattern-left');panelState()}
 side.prepend(button('Thu gọn bảng trái',()=>toggle('left',false)));
 for(const id of ['railPhoto','railPdf','railGeometry','railTools','railPaper'])$(id).addEventListener('click',()=>{inputFold.open=true;toggle('left',true)});
 $('quickGeometry').addEventListener('click',()=>{inputFold.open=true;toggle('left',true)});
 // Selecting a piece no longer unexpectedly expands the inspector.
 $('editActivePiece').addEventListener('click',()=>{if(innerWidth<1100)toggle('right',false)});
 const bar=document.querySelector('.draft-viewbar');bar.querySelector('.viewbar-help')?.remove();
 $('draftZoom').closest('label').classList.add('pattern-zoom-slider');$('draftPaperLabel').title='Khổ giấy không thay đổi khi phóng to vùng xem';
 const zoomLabel=$('draftZoomValue');bar.insertBefore(zoomLabel,$('draftZoomIn'));
 function sizeCanvas(){layout.style.setProperty('--workbench-top',Math.max(0,layout.getBoundingClientRect().top+scrollY)+'px');for(const cv of [$('draft')]){const box=cv.parentElement;if(!box.clientWidth||!box.clientHeight)continue;const w=Math.min(box.clientWidth-16,(box.clientHeight-16)*cv.width/cv.height);if(w>0){cv.style.width=w+'px';cv.style.height=w*cv.height/cv.width+'px'}}}
 window.addEventListener('resize',sizeCanvas);const header=document.querySelector('body>header');if(header)new ResizeObserver(sizeCanvas).observe(header);const observer=new ResizeObserver(sizeCanvas);observer.observe($('draft').parentElement); // CSS display dimensions only: model coordinates remain unchanged.
 function mode(){openPaper.disabled=$('paperTab').disabled;steps[2].disabled=$('paperTab').disabled;const paper=workspace.classList.contains('focus-paper')&&workspace.classList.contains('reviewing');steps.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===(paper?2:inputFold.open?0:1))));sizeCanvas()}
 new MutationObserver(mode).observe(workspace,{attributes:true,attributeFilter:['class']});new MutationObserver(mode).observe($('paperTab'),{attributes:true,attributeFilter:['disabled']});inputFold.addEventListener('toggle',mode);
 let hadImage=false;
 const sync=()=>{if(image&&!hadImage)inputFold.open=false;hadImage=!!image;syncTransfer();openPaper.disabled=!staged;const nodes=[...$('pieceStrip').children];const small=nodes.filter(e=>e.classList.contains('marked'));tiny.querySelector('.pattern-tiny-list').replaceChildren(...small);tiny.querySelector('summary').textContent=`Nét nhỏ cần kiểm tra · ${small.length}`;tiny.hidden=!small.length;if(small.some(e=>e.classList.contains('selected')))tiny.open=true;filterPieces();};
 globalThis.patternWorkspaceRefresh=sync;sync();mode();
 const compact=matchMedia('(max-width:1099px)');function resetPanels(){toggle('right',false);toggle('left',!compact.matches);sizeCanvas()}compact.addEventListener('change',resetPanels);resetPanels();
 $('pieceList').addEventListener('click',e=>{if(compact.matches&&e.target.closest('.pattern-piece-zoom'))toggle('left',false)});
 function positionMenu(detail,content){if(!detail.open)return;const r=detail.getBoundingClientRect();content.style.left=Math.max(8,Math.min(r.left,innerWidth-Math.min(360,innerWidth-16)-8))+'px';content.style.top=Math.min(r.bottom+5,innerHeight-120)+'px';content.style.maxHeight=Math.max(100,innerHeight-r.bottom-16)+'px'}
 more.addEventListener('toggle',()=>positionMenu(more,moreBody));
 window.addEventListener('resize',()=>positionMenu(more,moreBody));


 const shortcutDialog=make('dialog','pattern-shortcut-dialog');shortcutDialog.setAttribute('aria-labelledby','patternShortcutTitle');
 const shortcutTitle=make('h2','','Phím tắt Phác thảo rập');shortcutTitle.id='patternShortcutTitle';const closeKeys=button('Đóng',()=>shortcutDialog.close());
 shortcutDialog.append(shortcutTitle,make('p','','Windows dùng Ctrl · Mac dùng Command (⌘). Bấm vào vùng vẽ trước khi thao tác.'));
 const table=make('table','');const rows=[['Phím','Thao tác'],['V / A','Di chuyển chi tiết / chỉnh điểm'],['B / P','Vẽ tự do / bút Pen'],['H / giữ Space + kéo','Bàn tay / di chuyển vùng xem tạm thời'],['T','Thêm chữ'],['M','Chọn nhiều chi tiết bằng khung'],['U / Shift + U','Hình chữ nhật / hình bầu dục'],['Z · Alt/Option + bấm','Bấm phóng to · bấm thu nhỏ'],['Ctrl/⌘ + + hoặc −','Phóng to / thu nhỏ vùng vẽ hoặc giấy'],['Ctrl/⌘ + 0','Vừa khung'],['Ctrl/⌘ + Z','Hoàn tác'],['Ctrl/⌘ + Shift + Z','Làm lại (Ctrl/⌘ + Y cũng được)'],['Ctrl/⌘ + A / D','Chọn tất cả / bỏ chọn chi tiết trên bản vẽ'],['F / Shift + F','Toàn màn hình / phóng vừa chi tiết'],['Tab (khi vùng vẽ có tiêu điểm)','Ẩn / hiện hai bảng bên'],['Mũi tên / Shift + mũi tên','Dịch chi tiết 1 mm / 10 mm ở chế độ V'],['Esc','Hủy nét đang vẽ hoặc thoát chế độ hiện tại'],['?','Mở bảng phím tắt']];
 rows.forEach((row,i)=>{const tr=make('tr','');row.forEach(value=>tr.append(make(i?'td':'th','',value)));table.append(tr)});shortcutDialog.append(table,make('p','','Phím tắt không chạy khi nhập chữ, số đo hoặc mở hộp thoại. Các thao tác chọn/vẽ áp dụng cho bản phác thảo; không thay thế toàn bộ chức năng Photoshop.'),closeKeys);document.body.append(shortcutDialog);
 let keysOpener;function showKeys(){if(shortcutDialog.open)return;keysOpener=document.activeElement;shortcutDialog.showModal();closeKeys.focus()}shortcutDialog.addEventListener('close',()=>keysOpener?.focus());document.addEventListener('pattern-show-shortcuts',showKeys);

 let savedPanels=null;document.addEventListener('pattern-toggle-panels',()=>{if(savedPanels){const saved=savedPanels;savedPanels=null;toggle('left',saved.left);toggle('right',saved.right)}else{savedPanels={left:!document.body.classList.contains('hide-pattern-left'),right:!document.body.classList.contains('hide-pattern-right')};toggle('left',false);toggle('right',false)}});
 for(const [id,key] of [['quickMovePiece','V'],['quickEdit','A'],['quickPencil','B'],['quickPen','P'],['quickPan','H'],['quickText','T'],['quickRectangle','U'],['quickEllipse','Shift+U'],['quickFullscreen','F'],['draftFitPiece','Shift+F']])$(id).title=($(id).getAttribute('aria-label')||$(id).textContent.trim())+' ('+key+')';
 // Context help belongs to its command; never overlay the sheet with a shortcut card.
 for(const [id,tip] of [
 ['quickUndo','Hoàn tác · Ctrl/⌘ + Z'],['quickRedo','Làm lại · Ctrl/⌘ + Shift + Z'],
 ['paperUndo','Hoàn tác · Ctrl/⌘ + Z'],['paperRedo','Làm lại · Ctrl/⌘ + Shift + Z'],
 ['draftFit','Vừa vùng vẽ · Ctrl/⌘ + 0'],['paperFit','Vừa trang giấy · Ctrl/⌘ + 0'],
 ['paperMove','Kéo để di chuyển chi tiết trên giấy'],['paperEdit','Kéo nút neo để sửa đường viền; phóng to để chọn chính xác'],
 ['paperSelect','Kéo khung chọn nhiều chi tiết rồi kéo nhóm'],['paperPan','Kéo để di chuyển vùng xem giấy; có thể giữ Space hoặc dùng chuột phải'],
 ['paperText','Bấm trên giấy để thêm hoặc chọn chữ; kéo chữ để đổi vị trí'],
 ['reflowPaper','Tự sắp xếp lại các chi tiết trên khổ giấy hiện tại'],
 ['paperShowDimensions','Hiện hoặc ẩn kích thước trên bản vẽ và tệp xuất']
 ])$(id).title=tip;

 // Persistent horizontal commands, two independently scrollable working panes.
 document.body.classList.add('pattern-dual-workspace');
 quick.prepend(drawing);more.replaceWith(moreBody);moreBody.classList.add('pattern-inline-tools');
 const paperTools=document.querySelector('.paper-edit-tools');paperTools.classList.add('pattern-horizontal-paper-tools');quick.append(paperTools);
 paperTools.prepend(make('strong','pattern-tool-group-label','Giấy in'));
 const dual=make('div','pattern-dual-panes');dual.id='patternDualPanes';workspace.append(dual);
 const draft=$('editStage'),paper=$('paperStage'),divider=$('paneDivider');dual.append(draft,divider,paper);
 const draftTitle=make('div','pattern-pane-title','Ảnh & vẽ rập');draft.prepend(draftTitle);draftTitle.after(bar);
 const emptyPaper=make('div','pattern-empty-paper','Chưa có chi tiết trên giấy. Chọn chi tiết ở vùng vẽ rồi bấm “Đưa lên giấy…” để bố trí và in.');paper.prepend(emptyPaper);
 const dualButton=button('▥ Hai vùng',()=>setPaneMode('split'));panelShortcuts.prepend(dualButton);
 const balance=button('50 / 50',()=>{setSplitRatio(50);setPaneMode('split')});balance.title='Chia đều hai vùng làm việc';panelShortcuts.append(balance);
 const syncDual=()=>{paper.classList.toggle('pattern-paper-empty',!staged);emptyPaper.hidden=!!staged;dualButton.setAttribute('aria-pressed',String(paneMode==='split'));divider.setAttribute('aria-orientation',innerWidth<=700?'horizontal':'vertical');};
 new MutationObserver(syncDual).observe(workspace,{attributes:true,attributeFilter:['class']});new MutationObserver(syncDual).observe($('paperTab'),{attributes:true,attributeFilter:['disabled']});window.addEventListener('resize',syncDual);
 divider.title='Kéo để đổi kích thước hai vùng · Nhấp đúp để chia đều';divider.setAttribute('aria-label','Đổi tỷ lệ hai vùng làm việc');divider.setAttribute('aria-valuemin','20');divider.setAttribute('aria-valuemax','80');divider.ondblclick=()=>setSplitRatio(50);
 divider.addEventListener('pointerup',e=>{if(divider.hasPointerCapture(e.pointerId))divider.releasePointerCapture(e.pointerId)});
 const review=document.querySelector('.review-panel'),exportFold=make('details','pattern-export-fold');exportFold.append(make('summary','','Kiểm tra & xuất bản giấy'),review);paper.append(exportFold);
 function sizePaper(){const cv=$('paperPreview');if(!paper.clientWidth||!paper.clientHeight)return;const controls=cv.getBoundingClientRect().top-paper.getBoundingClientRect().top+paper.scrollTop;const available=Math.max(80,paper.clientHeight-controls-65);const width=Math.min(Math.max(40,paper.clientWidth-20),available*cv.width/cv.height);cv.style.width=width+'px';cv.style.height=width*cv.height/cv.width+'px';}
 new ResizeObserver(sizePaper).observe(paper);new MutationObserver(sizePaper).observe($('paperPreview'),{attributes:true,attributeFilter:['width','height']});
 toggle('left',false);toggle('right',false);setPaneMode('split');syncDual();sizeCanvas();

 // Function rail and one contextual tool panel, inspired by the supplied layout.
 document.body.classList.add('pattern-category-workspace');
 const functionRail=make('nav','pattern-function-rail');functionRail.setAttribute('aria-label','Nhóm công cụ rập');layout.append(functionRail);
 const categoryTitle=make('h2','pattern-category-title','Vẽ rập');side.insertBefore(categoryTitle,inputFold);
 const categories=new Map(),categoryButtons=new Map();let currentCategory='draw';
 function category(key,title){const panel=make('section','pattern-category-panel');panel.setAttribute('aria-label',title);panel.hidden=true;side.append(panel);categories.set(key,panel);return panel;}
 const drawPanel=category('draw','Vẽ và chỉnh đường rập'),textPanel=category('text','Văn bản và ghi chú'),sizePanel=category('size','Số đo và khổ giấy'),sheetPanel=category('sheet','Bố trí giấy in');
 const moveTo=(panel,ids)=>{for(const id of ids){const node=$(id);if(node)panel.append(node)}};
 moveTo(textPanel,['quickText','quickSelectText','quickEditText','quickDeleteText','paperText']);
 drawPanel.append(drawing);const shapes=moreBody.querySelector('.quick-shapes');if(shapes)drawPanel.append(shapes);
 moveTo(drawPanel,['quickDraw','quickAddPiece','quickRegion','quickDetectAdditional']);
 moveTo(sizePanel,['quickGeometry']);const preset=$('paperPreset').closest('label');if(preset)sizePanel.append(preset);const rulers=$('showRulers').closest('label');if(rulers)sizePanel.append(rulers);
 sizePanel.append(button('Khổ giấy & thông số chi tiết',()=>$('railPaper').click()),button('Sửa kích thước chi tiết đang chọn',()=>toggle('right',true)),make('p','hint','Nhập kích thước thực tế theo mm trong Thuộc tính. Zoom chỉ thay đổi vùng xem.'));
 sheetPanel.append(paperTools);paperTools.querySelector('.pattern-tool-group-label')?.remove();
 sheetPanel.append(button('Đưa chi tiết lên giấy…',()=>{toggle('left',false);launchTransfer.click()}),button('Kiểm tra & xuất bản giấy',()=>{if(!staged){status('Đưa chi tiết lên giấy trước khi xuất.');return}toggle('left',false);exportFold.open=true;exportFold.scrollIntoView({block:'nearest'});}));
 textPanel.append(make('p','hint','Chữ trên bản vẽ: chọn Thêm chữ. Chữ trên giấy in: chọn Thêm / chọn chữ.'),button('Mở thuộc tính chữ trên bản vẽ',()=>toggle('right',true)));
 textPanel.append(document.querySelector('.paper-text-controls'));
 const extra=make('details','pattern-extra-tools');extra.append(make('summary','','Nhận diện & công cụ bổ sung'),moreBody);drawPanel.append(extra);
 function showCategory(key){currentCategory=key;const titles={file:'Tệp & nhập bản vẽ',draw:'Vẽ & chỉnh rập',pieces:'Chi tiết bản vẽ',text:'Văn bản',size:'Số đo & khổ giấy',sheet:'Giấy in'};categoryTitle.textContent=titles[key]||'Công cụ';inputFold.hidden=key!=='file';list.hidden=key!=='pieces';for(const [name,panel] of categories)panel.hidden=name!==key;for(const [name,b] of categoryButtons){b.setAttribute('aria-pressed',String(name===key));}if(key==='file')inputFold.open=true;if(document.body.classList.contains('drawing-focus'))$('quickFullscreen').click();toggle('left',true);side.scrollTop=0;}
 for(const [key,icon,label] of [['file','↥','Tệp'],['draw','✎','Vẽ rập'],['pieces','▧','Chi tiết'],['text','T','Văn bản'],['size','↔','Số đo'],['sheet','▤','Giấy in']]){const b=button('',()=>{if(currentCategory===key&&!document.body.classList.contains('hide-pattern-left'))toggle('left',false);else showCategory(key)});b.replaceChildren(make('span','',icon),make('small','',label));b.title=label;b.setAttribute('aria-controls','patternSourcePanel');categoryButtons.set(key,b);functionRail.append(b);}
 window.addEventListener('pattern-open-dimensions',()=>{showCategory('pieces');toggle('right',true);$('activeWidthMm').scrollIntoView({block:'nearest'});$('activeWidthMm').focus();});
 window.addEventListener('pattern-file-opened',event=>{document.body.dataset.patternInputKind=event.detail.kind;showCategory(event.detail.kind==='pattern'?'pieces':'file');});
 const prop=button('',()=>openPanel('right'));prop.replaceChildren(make('span','','⚙'),make('small','','Thuộc tính'));functionRail.append(prop);
 piecesButton.onclick=()=>showCategory('pieces');pick.onclick=()=>showCategory('pieces');
 for(const id of ['railPhoto','railPdf','railGeometry','railTools','railPaper'])$(id).addEventListener('click',()=>showCategory('file'));
 $('quickGeometry').addEventListener('click',()=>showCategory('file'));
 steps[0].addEventListener('click',()=>showCategory('file'));
 drawPanel.addEventListener('click',e=>{if(innerWidth<1100&&e.target.closest('.pattern-drawing-tools button'))toggle('left',false)});
 showCategory('draw');if(innerWidth<1100)toggle('left',false);sizeCanvas();

})();
