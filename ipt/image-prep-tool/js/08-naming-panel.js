/* ============================================================
   MODULE 08 — ПАНЕЛЬ ИМЕНОВАНИЯ (Раздел → Объект → Вариация)
   Выбор раздела/объекта «липкий» — сохраняется между захватами слоёв, меняется только вариация
   для следующего однотипного объекта. Смена активного слоя (клик по нему или новый захват)
   сразу применяет текущий выбор как имя слоя — дальше достаточно поменять вариацию.
   ============================================================ */

let pickState={groupId:'',itemId:'',variantIdx:-1};

function selOpts(sel,options,current){
  const cur=current!==undefined?current:sel.value;
  sel.innerHTML=options.map(([v,l])=>`<option value="${esc(v)}">${esc(l)}</option>`).join('');
  if(options.some(([v])=>v===cur)) sel.value=cur;
}
function refreshNamingPanel(){
  const pkGroup=document.getElementById('pkGroup'), ownGroup=document.getElementById('ownGroup'), ownCat=document.getElementById('ownCat');
  const groups=planEffectiveGroups();
  selOpts(pkGroup,[['','— раздел —']].concat(groups.map(g=>[g.id,g.name])),pickState.groupId);
  if(!groups.some(g=>g.id===pickState.groupId)) pickState.groupId='';
  pkGroup.value=pickState.groupId;

  const ownGroupCur=ownGroup.value;
  ownGroup.innerHTML=[['','— раздел —']].concat(groups.map(g=>[g.id,g.name])).map(([v,l])=>`<option value="${esc(v)}">${esc(l)}</option>`).join('')+`<option value="__new__">+ новый раздел…</option>`;
  if(groups.some(g=>g.id===ownGroupCur)||ownGroupCur==='__new__') ownGroup.value=ownGroupCur;

  if(!ownCat.options.length) ownCat.innerHTML=CATEGORIES.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');

  populateItemSelect();
}
function populateItemSelect(){
  const pkItem=document.getElementById('pkItem');
  const items=planAllItems().filter(i=>i.g===pickState.groupId).sort((a,b)=>a.n.localeCompare(b.n,'ru'));
  pkItem.disabled=!pickState.groupId;
  selOpts(pkItem,[['','— объект —']].concat(items.map(i=>[i.id,i.n])),pickState.itemId);
  if(!items.some(i=>i.id===pickState.itemId)) pickState.itemId='';
  pkItem.value=pickState.itemId;
  populateVariantSelect();
}
function populateVariantSelect(){
  const pkVariant=document.getElementById('pkVariant');
  const item=pickState.itemId?planItemById(pickState.itemId):null;
  const vlist=(item&&item.v)||[];
  pkVariant.disabled=!item;
  const opts=[['', vlist.length?'— вариация —':'— без вариаций —']].concat(vlist.map((v,idx)=>[String(idx), variationRu(v)+' ('+variationEn(v)+')']));
  const cur=pickState.variantIdx>=0?String(pickState.variantIdx):'';
  pkVariant.innerHTML=opts.map(([v,l])=>`<option value="${esc(v)}">${esc(l)}</option>`).join('');
  pkVariant.value=opts.some(([v])=>v===cur)?cur:'';
  if(pkVariant.value==='') pickState.variantIdx=-1;
}
function resetPicker(){ refreshNamingPanel(); applyPickToActiveLayerIfAny(); }

function computeLayerName(){
  const item=pickState.itemId?planItemById(pickState.itemId):null;
  if(!item) return null;
  if(pickState.variantIdx>=0){
    const v=(item.v||[])[pickState.variantIdx];
    if(v) return item.id+'_'+variationEn(v);
  }
  return item.id;
}
function applyPickToActiveLayerIfAny(){
  const name=computeLayerName();
  if(!name) return;
  if(activeLayer()) setActiveLayerName(name,'plan');
}
function onActiveTargetChanged(key){
  if(key==='sheet') return;
  applyPickToActiveLayerIfAny();
}
function onLayerCreated(){ /* именование делает onActiveTargetChanged — вызывается setActiveTarget внутри захвата */ }

document.getElementById('pkGroup').addEventListener('change',e=>{ pickState.groupId=e.target.value; pickState.itemId=''; pickState.variantIdx=-1; populateItemSelect(); applyPickToActiveLayerIfAny(); });
document.getElementById('pkItem').addEventListener('change',e=>{ pickState.itemId=e.target.value; pickState.variantIdx=-1; populateVariantSelect(); applyPickToActiveLayerIfAny(); });
document.getElementById('pkVariant').addEventListener('change',e=>{ pickState.variantIdx=e.target.value===''?-1:Number(e.target.value); applyPickToActiveLayerIfAny(); });

document.getElementById('ownGroup').addEventListener('change',e=>{
  document.getElementById('ownGroupName').style.display=e.target.value==='__new__'?'':'none';
});
document.getElementById('btnOwnApply').addEventListener('click',async ()=>{
  const groupSel=document.getElementById('ownGroup').value;
  const newGroupName=document.getElementById('ownGroupName').value;
  const name=document.getElementById('ownItemName').value;
  const categoryId=document.getElementById('ownCat').value;
  const variationRuVal=document.getElementById('ownVariant').value;
  if(!groupSel){ alert('Выбери раздел (или «+ новый раздел…»).'); return; }
  if(!name.trim()){ alert('Укажи название объекта.'); return; }
  try{
    const {item,groupId}=await addOrUpdatePlanItem({groupId:groupSel,newGroupName,name,categoryId,variationRu:variationRuVal});
    pickState.groupId=groupId;
    refreshNamingPanel();
    pickState.itemId=item.id;
    document.getElementById('pkGroup').value=groupId;
    populateItemSelect();
    document.getElementById('pkItem').value=item.id;
    if(variationRuVal.trim()){
      const idx=item.v.findIndex(v=>variationEn(v)===sanitizeSlug(variationRuVal)||normName(variationRu(v))===normName(variationRuVal));
      pickState.variantIdx=idx;
    } else pickState.variantIdx=-1;
    populateVariantSelect();
    document.getElementById('pkVariant').value=pickState.variantIdx>=0?String(pickState.variantIdx):'';
    applyPickToActiveLayerIfAny();
    document.getElementById('ownGroup').value=''; document.getElementById('ownGroupName').style.display='none'; document.getElementById('ownGroupName').value='';
    document.getElementById('ownItemName').value=''; document.getElementById('ownVariant').value='';
  }catch(err){ alert(err.message); }
});

refreshNamingPanel();
