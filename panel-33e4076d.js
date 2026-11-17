(function(){
  var SB_URL='https://akcpicfbqyalgukxvkxd.supabase.co';
  var SB_KEY='sb_publishable__hekFZ-AwpL7hRWv3DHrlQ_jh73d-AW';
  var STATUSES=['جديد','تم التأكيد','تم الإرسال للشحن','تم الشحن','تم التسليم','مرتجع','ملغي'];
  var session=null;
  try{ session=JSON.parse(sessionStorage.getItem('kf_admin')||'null'); }catch(e){}
  var $=function(id){return document.getElementById(id);};
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function toast(m){var t=$('toast');t.textContent=m;t.style.display='block';clearTimeout(toast._t);toast._t=setTimeout(function(){t.style.display='none';},2200);}
  function saveSession(){try{sessionStorage.setItem('kf_admin',JSON.stringify(session));}catch(e){}}

  // ---- auth ----
  function authCall(grant,body){
    return fetch(SB_URL+'/auth/v1/token?grant_type='+grant,{method:'POST',headers:{apikey:SB_KEY,'Content-Type':'application/json'},body:JSON.stringify(body)})
      .then(function(r){return r.json().then(function(d){if(!r.ok)throw new Error(d.error_description||d.msg||'خطأ');return d;});});
  }
  function setSession(d){session={access:d.access_token,refresh:d.refresh_token};saveSession();}
  function refresh(){
    if(!session||!session.refresh)return Promise.reject(new Error('no session'));
    return authCall('refresh_token',{refresh_token:session.refresh}).then(setSession);
  }
  // ---- db ----
  function db(path,opts,retry){
    opts=opts||{};
    var h={apikey:SB_KEY,Authorization:'Bearer '+session.access,'Content-Type':'application/json'};
    if(opts.prefer)h.Prefer=opts.prefer;
    return fetch(SB_URL+'/rest/v1/'+path,{method:opts.method||'GET',headers:h,body:opts.body?JSON.stringify(opts.body):undefined}).then(function(r){
      if((r.status===401||r.status===403)&&!retry){return refresh().then(function(){return db(path,opts,true);}).catch(function(){logout();throw new Error('انتهت الجلسة');});}
      return r.text().then(function(t){var d=t?JSON.parse(t):null;if(!r.ok)throw new Error((d&&d.message)||'خطأ');return d;});
    });
  }
  function logout(){session=null;try{sessionStorage.removeItem('kf_admin');}catch(e){}$('app').hidden=true;$('login').hidden=false;}

  $('l-btn').addEventListener('click',function(){
    $('l-err').textContent='';
    authCall('password',{email:$('l-email').value.trim(),password:$('l-pass').value}).then(function(d){setSession(d);start();})
      .catch(function(e){$('l-err').textContent='الإيميل أو كلمة السر غلط';});
  });
  $('l-pass').addEventListener('keydown',function(e){if(e.key==='Enter')$('l-btn').click();});
  $('logout').addEventListener('click',logout);

  // ---- tabs ----
  document.querySelectorAll('.tab').forEach(function(t){
    t.addEventListener('click',function(){
      document.querySelectorAll('.tab').forEach(function(x){x.classList.toggle('on',x===t);});
      ['orders','products','shipping','areas'].forEach(function(n){$('t-'+n).hidden=(n!==t.dataset.tab);});
      if(t.dataset.tab==='orders')loadOrders();
      if(t.dataset.tab==='products')loadProducts();
      if(t.dataset.tab==='shipping')loadShipping();
      if(t.dataset.tab==='areas')loadAreas();
    });
  });

  // ---- orders ----
  function fmtDT(s){try{return new Date(s).toLocaleString('en-GB',{timeZone:'Africa/Cairo',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true}).toUpperCase();}catch(e){return s;}}
  function waLink(phone){return 'https://wa.me/2'+phone.replace(/^0/,'0');}
  function loadOrders(){
    var f=$('o-filter').value;
    var q='orders?select=*&order=order_no.desc&limit=200'+(f?'&status=eq.'+encodeURIComponent(f):'');
    var term=$('o-search').value.trim().replace(/[٠-٩]/g,function(d){return '٠١٢٣٤٥٦٧٨٩'.indexOf(d);}).replace(/^#/,'').replace(/[,()*%\\"']/g,'').trim();
    if(term){
      var conds=['name.ilike.*'+term+'*'];
      var digits=term.replace(/[\s+\-]/g,'');
      if(/^\d+$/.test(digits)){
        if(digits.length<=9)conds.push('order_no.eq.'+parseInt(digits,10));
        if(/^201[0125]\d{8}$/.test(digits))digits='0'+digits.slice(2);
        conds.push('phone.like.*'+digits+'*');
      }
      q+='&or='+encodeURIComponent('('+conds.join(',')+')');
    }
    db(q).then(function(rows){
      $('o-count').textContent=rows.length+' أوردر';
      var list=$('o-list');list.innerHTML='';
      if(!rows.length){list.innerHTML='<div class="box muted">مفيش أوردرات</div>';}
      rows.forEach(function(o){
        var d=document.createElement('div');d.className='box';
        var items=(o.items||[]).map(function(i){return '<div><span>'+esc(i.name)+' × '+esc(i.qty)+'</span><span>'+esc(i.line_total)+' جنيه</span></div>';}).join('');
        d.innerHTML=
          '<div class="ohead"><strong>#'+o.order_no+' — '+esc(o.name)+'</strong><span class="muted">'+esc(fmtDT(o.created_at))+'</span></div>'+
          '<div>📞 <a href="tel:'+esc(o.phone)+'">'+esc(o.phone)+'</a> · <a target="_blank" rel="noopener" href="https://wa.me/2'+esc(o.phone)+'">واتساب</a>'+(o.phone2?' · 📞 <a href="tel:'+esc(o.phone2)+'">'+esc(o.phone2)+'</a>':'')+'</div>'+
          '<div>📍 '+esc(o.governorate)+' — '+esc(o.city)+'<br><span class="muted">'+esc(o.address)+'</span></div>'+
          (o.note?'<div class="muted">📝 '+esc(o.note)+'</div>':'')+
          '<div class="muted">📦 '+esc(o.cartons==null?'':o.cartons+' كرتونة')+(o.weight_kg!=null?' · '+esc(Number(o.weight_kg))+' كجم':'')+'</div>'+
          '<div class="items">'+items+
            '<div><span>الشحن</span><span>'+esc(o.shipping)+' جنيه</span></div>'+
            '<div class="tot"><span>المطلوب تحصيله</span><span>'+esc(o.total)+' جنيه</span></div></div>'+
          '<div class="row"><div><label>الحالة</label><select data-f="status">'+STATUSES.map(function(s){return '<option'+(s===o.status?' selected':'')+'>'+s+'</option>';}).join('')+'</select></div>'+
          '<div><label>رقم التتبع</label><input data-f="tracking" dir="ltr" value="'+esc(o.tracking||'')+'"></div>'+
          '<div style="flex:0;display:flex;gap:6px"><button class="btn green" data-a="save">حفظ</button></div></div>'+
          (o.shipped_at?'<div class="ship-ok">✓ اتبعت لشركة الشحن'+(o.ship_ref?' — '+esc(String(o.ship_ref).slice(0,120)):'')+'</div>':
            (o.ship_error?'<div class="ship-err">⚠ فشل الإرسال: '+esc(o.ship_error)+'</div>':'')+
            (['ملغي','مرتجع','تم التسليم'].indexOf(o.status)<0?'<div style="margin-top:8px;display:flex;gap:6px"><button class="btn" data-a="ship">إرسال للشحن</button><button class="btn ghost" data-a="prev">معاينة</button></div>':''));
        var sb=d.querySelector('[data-a=ship]'),pb=d.querySelector('[data-a=prev]');
        if(sb)sb.addEventListener('click',function(){
          if(!confirm('إرسال الأوردر #'+o.order_no+' لشركة الشحن؟'))return;
          sendToShipping([o.order_no],false).then(function(r){toast(r.results[0].ok?'تم الإرسال':(r.results[0].message||'فشل'));loadOrders();refreshNew();loadStats();}).catch(function(e){toast(e.message);});
        });
        if(pb)pb.addEventListener('click',function(){
          sendToShipping([o.order_no],true).then(function(r){var x=r.results[0];showOv(x.payload?JSON.stringify(x.payload,null,2):x.message);}).catch(function(e){toast(e.message);});
        });
        d.querySelector('[data-a=save]').addEventListener('click',function(){
          db('orders?id=eq.'+o.id,{method:'PATCH',prefer:'return=minimal',body:{status:d.querySelector('[data-f=status]').value,tracking:d.querySelector('[data-f=tracking]').value.trim()||null}})
            .then(function(){toast('تم الحفظ');refreshNew();loadStats();}).catch(function(e){toast(e.message);});
        });
        list.appendChild(d);
      });
    }).catch(function(e){toast(e.message);});
  }
  function showOv(t){$('ov-text').textContent=t;$('ov').hidden=false;}
  $('ov-close').addEventListener('click',function(){$('ov').hidden=true;});
  function sendToShipping(nos,preview,retry){
    return fetch(SB_URL+'/functions/v1/send-to-shipping',{method:'POST',
      headers:{apikey:SB_KEY,Authorization:'Bearer '+session.access,'Content-Type':'application/json'},
      body:JSON.stringify({order_nos:nos,preview:!!preview})}).then(function(r){
      if(r.status===401&&!retry)return refresh().then(function(){return sendToShipping(nos,preview,true);}).catch(function(){logout();throw new Error('انتهت الجلسة');});
      return r.json().catch(function(){return {};}).then(function(d){
        if(!r.ok)throw new Error(d.error||(r.status===404?'الدالة send-to-shipping مش منشورة على Supabase':'خطأ '+r.status));
        return d;});
    });
  }
  $('o-sendall').addEventListener('click',function(){
    db('orders?select=order_no&status=eq.'+encodeURIComponent('تم التأكيد')+'&shipped_at=is.null&order=order_no.asc&limit=500').then(function(rows){
      if(!rows.length){toast('مفيش أوردرات مؤكدة مستنية إرسال');return;}
      if(!confirm('إرسال '+rows.length+' أوردر مؤكد لشركة الشحن؟'))return;
      var nos=rows.map(function(r){return r.order_no;}),chunks=[],i;
      for(i=0;i<nos.length;i+=50)chunks.push(nos.slice(i,i+50));
      var ok=0,bad=0;
      return chunks.reduce(function(p,c){return p.then(function(){return sendToShipping(c,false).then(function(r){r.results.forEach(function(x){if(x.ok)ok++;else bad++;});});});},Promise.resolve())
        .then(function(){toast('اتبعت '+ok+(bad?' — فشل '+bad:''));loadOrders();refreshNew();loadStats();});
    }).catch(function(e){toast(e.message);});
  });
  $('o-filter').addEventListener('change',loadOrders);
  var searchTimer=null;
  $('o-search').addEventListener('input',function(){clearTimeout(searchTimer);searchTimer=setTimeout(loadOrders,300);});
  $('o-refresh').addEventListener('click',function(){loadOrders();refreshNew();loadStats();});
  // ---- stats (بتتحدث مع كل تغيير، وكل دقيقة لوحدها) ----
  function money(n){return Number(n||0).toLocaleString('en-US')+' EGP';}
  function fetchAllOrdersLite(offset,acc){
    return db('orders?select=status,subtotal&order=order_no.asc&limit=1000&offset='+offset).then(function(rows){
      acc=acc.concat(rows);
      return rows.length===1000?fetchAllOrdersLite(offset+1000,acc):acc;
    });
  }
  function loadStats(){
    fetchAllOrdersLite(0,[]).then(function(rows){
      var total=0,cnt=0,deliv=0,ret=0,retC=0,can=0,canC=0;
      rows.forEach(function(o){
        var v=o.subtotal||0;
        if(o.status==='مرتجع'){ret+=v;retC++;}
        else if(o.status==='ملغي'){can+=v;canC++;}
        else{total+=v;cnt++;if(o.status==='تم التسليم')deliv+=v;}
      });
      $('st-total').textContent=money(total);$('st-count').textContent=cnt+' أوردر';
      $('st-delivered').textContent=money(deliv);
      $('st-ret').textContent=money(ret);$('st-ret-c').textContent=retC;
      $('st-can').textContent=money(can);$('st-can-c').textContent=canC;
    }).catch(function(){});
  }
  function refreshNew(){
    db('orders?select=id&status=eq.'+encodeURIComponent('جديد')).then(function(r){var b=$('new-count');b.hidden=!r.length;b.textContent=r.length;}).catch(function(){});
  }

  // ---- products ----
  function loadProducts(){
    db('products?select=*&order=sort.asc').then(function(rows){
      var list=$('p-list');list.innerHTML='';
      rows.forEach(function(p){
        var d=document.createElement('div');d.className='box';
        d.innerHTML=
          '<div class="row">'+
          '<div style="flex:2"><label>الاسم</label><input data-f="name" value="'+esc(p.name)+'"></div>'+
          '<div style="flex:2"><label>وصف قصير</label><input data-f="subtitle" value="'+esc(p.subtitle||'')+'"></div></div>'+
          '<div class="row" style="margin-top:8px">'+
          '<div><label>السعر العادي</label><input data-f="price" type="number" min="0" value="'+p.price+'"></div>'+
          '<div><label>سعر العرض (فاضي = مفيش عرض)</label><input data-f="offer_price" type="number" min="0" value="'+(p.offer_price==null?'':p.offer_price)+'"></div>'+
          '<div><label>العرض لحد تاريخ</label><input data-f="offer_until" type="date" value="'+(p.offer_until||'')+'"></div>'+
          '<div><label>الترتيب</label><input data-f="sort" type="number" value="'+p.sort+'"></div>'+
          '<div><label>وزن الكرتونة (كجم)</label><input data-f="weight_kg" type="number" min="0.1" step="0.1" value="'+(p.weight_kg==null?1:p.weight_kg)+'"></div></div>'+
          '<div class="row" style="margin-top:8px">'+
          '<div><label>الكمية المتاحة (فاضي = غير محدود، 0 = نفذت)</label><input data-f="stock" type="number" min="0" value="'+(p.stock==null?'':p.stock)+'"></div>'+
          '<div><label>يظهر العدد المتبقي لما الكمية تبقى</label><input data-f="low_stock_at" type="number" min="1" value="'+(p.low_stock_at==null?5:p.low_stock_at)+'"></div>'+
          '<div class="muted" style="flex:2">'+(p.stock!=null&&p.stock<=0?'<b style="color:var(--red)">نفذت الكمية — مش ظاهر للشراء</b>':'الكمية بتقل لوحدها مع كل أوردر')+'</div></div>'+
          '<div class="row" style="margin-top:8px">'+
          '<div style="flex:3"><label>الصورة (الرفع بيحفظ تلقائي)'+(p.image_key&&!p.image_url?' — حاليا صورة الموقع الأصلية':'')+'</label>'+
            '<div class="imgrow"><img class="thumb" data-t="thumb"'+(p.image_url?' src="'+esc(p.image_url)+'"':' hidden')+'>'+
            '<input type="file" accept="image/*" data-t="file"><button type="button" class="btn ghost" data-a="rmimg"'+(p.image_url?'':' hidden')+'>مسح الصورة</button>'+
            '<input data-f="image_url" type="hidden" value="'+esc(p.image_url||'')+'"></div><div class="muted" data-t="up"></div></div>'+
          '<div style="flex:0;white-space:nowrap"><label><input data-f="active" type="checkbox"'+(p.active?' checked':'')+'> ظاهر في الموقع</label></div>'+
          '<div style="flex:0;display:flex;gap:6px"><button class="btn green" data-a="save">حفظ</button><button class="btn red" data-a="del">حذف</button></div></div>';
        var g=function(f){return d.querySelector('[data-f='+f+']');};
        d.querySelector('[data-a=save]').addEventListener('click',function(){
          var offer=g('offer_price').value, stk=g('stock').value;
          db('products?id=eq.'+encodeURIComponent(p.id),{method:'PATCH',prefer:'return=minimal',body:{
            name:g('name').value.trim(),subtitle:g('subtitle').value.trim()||null,price:parseInt(g('price').value,10)||0,
            offer_price:offer===''?null:parseInt(offer,10),offer_until:g('offer_until').value||null,
            sort:parseInt(g('sort').value,10)||100,weight_kg:Math.max(0.1,parseFloat(g('weight_kg').value)||1),image_url:g('image_url').value.trim()||null,active:g('active').checked,
            stock:stk===''?null:Math.max(0,parseInt(stk,10)||0),low_stock_at:Math.max(1,parseInt(g('low_stock_at').value,10)||5)}})
            .then(function(){toast('تم الحفظ');loadProducts();}).catch(function(e){toast(e.message);});
        });
        var thumb=d.querySelector('[data-t=thumb]'),up=d.querySelector('[data-t=up]'),rm=d.querySelector('[data-a=rmimg]');
        function setImg(url){
          return db('products?id=eq.'+encodeURIComponent(p.id),{method:'PATCH',prefer:'return=minimal',body:{image_url:url}}).then(function(){
            g('image_url').value=url||'';
            if(url){thumb.src=url;thumb.hidden=false;rm.hidden=false;}else{thumb.hidden=true;rm.hidden=true;}
          });
        }
        d.querySelector('[data-t=file]').addEventListener('change',function(e){
          var f=e.target.files[0];if(!f)return;
          up.textContent='جاري الرفع...';
          uploadImage(f).then(setImg).then(function(){up.textContent='';toast('تم رفع الصورة');}).catch(function(er){up.textContent=er.message;});
        });
        rm.addEventListener('click',function(){setImg(null).then(function(){toast('تم مسح الصورة');}).catch(function(er){toast(er.message);});});
        d.querySelector('[data-a=del]').addEventListener('click',function(){
          if(!confirm('حذف "'+p.name+'" نهائيا؟ (ممكن بدل كده تشيل علامة ظاهر في الموقع)'))return;
          db('products?id=eq.'+encodeURIComponent(p.id),{method:'DELETE',prefer:'return=minimal'}).then(function(){toast('تم الحذف');loadProducts();}).catch(function(e){toast(e.message);});
        });
        list.appendChild(d);
      });
    }).catch(function(e){toast(e.message);});
  }
  // ---- image upload (Supabase Storage) ----
  function resizeImg(file,max){
    return new Promise(function(res,rej){
      var img=new Image(),u=URL.createObjectURL(file);
      img.onload=function(){
        var s=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement('canvas');
        c.width=Math.round(img.width*s);c.height=Math.round(img.height*s);
        c.getContext('2d').drawImage(img,0,0,c.width,c.height);
        c.toBlob(function(b){URL.revokeObjectURL(u);b?res(b):rej(new Error('تعذر معالجة الصورة'));},'image/jpeg',0.85);
      };
      img.onerror=function(){URL.revokeObjectURL(u);rej(new Error('الملف مش صورة صالحة'));};
      img.src=u;
    });
  }
  function uploadImage(file,retry){
    return resizeImg(file,1000).then(function(blob){
      var name='p'+Date.now()+'-'+Math.random().toString(36).slice(2,7)+'.jpg';
      return fetch(SB_URL+'/storage/v1/object/product-images/'+name,{method:'POST',
        headers:{apikey:SB_KEY,Authorization:'Bearer '+session.access,'Content-Type':'image/jpeg'},body:blob}).then(function(r){
        if(r.ok)return SB_URL+'/storage/v1/object/public/product-images/'+name;
        if((r.status===401||r.status===403)&&!retry)return refresh().then(function(){return uploadImage(file,true);});
        return r.json().catch(function(){return {};}).then(function(d){throw new Error(d.message||'فشل رفع الصورة (اتأكد إنك شغلت supabase-images.sql)');});
      });
    });
  }
  $('np-file').addEventListener('change',function(e){
    var f=e.target.files[0];if(!f)return;
    $('np-up').textContent='جاري الرفع...';
    uploadImage(f).then(function(url){$('np-img').value=url;$('np-thumb').src=url;$('np-thumb').hidden=false;$('np-up').textContent='';})
      .catch(function(er){$('np-up').textContent=er.message;});
  });
  $('np-add').addEventListener('click',function(){
    var name=$('np-name').value.trim(),price=parseInt($('np-price').value,10);
    if(!name||isNaN(price)){toast('اكتب الاسم والسعر');return;}
    db('products',{method:'POST',prefer:'return=minimal',body:{id:'p'+Date.now(),name:name,subtitle:$('np-sub').value.trim()||null,price:price,stock:$('np-stock').value===''?null:Math.max(0,parseInt($('np-stock').value,10)||0),image_url:$('np-img').value.trim()||null,weight_kg:Math.max(0.1,parseFloat($('np-weight').value)||1),sort:100}})
      .then(function(){toast('تمت الإضافة');['np-name','np-sub','np-price','np-stock','np-img','np-file'].forEach(function(i){$(i).value='';});$('np-thumb').hidden=true;loadProducts();}).catch(function(e){toast(e.message);});
  });

  // ---- shipping ----
  var REG={bahari:'وجه بحري',qibli:'وجه قبلي',other:'أخرى'};
  function loadShipping(){
    db('shipping_rates?select=*&order=sort.asc').then(function(rows){
      var list=$('s-list');list.innerHTML='';
      rows.forEach(function(r){
        var d=document.createElement('div');d.className='box';
        d.innerHTML='<div class="row"><div style="flex:2"><strong>'+esc(r.governorate)+'</strong> <span class="pill">'+REG[r.region]+'</span></div>'+
          '<div><label>سعر الشحن</label><input type="number" min="0" data-f="price" value="'+r.price+'"></div>'+
          '<div><label>كود المحافظة عند الشركة (CityId)</label><input type="number" min="0" data-f="cid" dir="ltr" value="'+(r.company_city_id==null?'':r.company_city_id)+'"></div>'+
          '<div style="flex:0;white-space:nowrap"><label><input type="checkbox" data-f="active"'+(r.active?' checked':'')+'> متاح التوصيل</label></div>'+
          '<div style="flex:0"><button class="btn green">حفظ</button></div></div>';
        d.querySelector('button').addEventListener('click',function(){
          db('shipping_rates?governorate=eq.'+encodeURIComponent(r.governorate),{method:'PATCH',prefer:'return=minimal',body:{
            price:parseInt(d.querySelector('[data-f=price]').value,10)||0,company_city_id:d.querySelector('[data-f=cid]').value===''?null:parseInt(d.querySelector('[data-f=cid]').value,10),active:d.querySelector('[data-f=active]').checked}})
            .then(function(){toast('تم الحفظ');}).catch(function(e){toast(e.message);});
        });
        list.appendChild(d);
      });
    }).catch(function(e){toast(e.message);});
  }
  $('b-apply').addEventListener('click',function(){
    var jobs=[];
    ['bahari','qibli','other'].forEach(function(reg){
      var v=$('b-'+reg).value;
      if(v!=='')jobs.push(db('shipping_rates?region=eq.'+reg,{method:'PATCH',prefer:'return=minimal',body:{price:parseInt(v,10)||0}}));
    });
    if(!jobs.length){toast('اكتب سعر الأول');return;}
    Promise.all(jobs).then(function(){toast('تم التطبيق');['b-bahari','b-qibli','b-other'].forEach(function(i){$(i).value='';});loadShipping();}).catch(function(e){toast(e.message);});
  });

  // ---- المدن والمناطق ----
  function loadAreas(){
    Promise.all([db('shipping_rates?select=governorate,sort&order=sort.asc'),db('areas?select=governorate&limit=10000')]).then(function(res){
      var cnt={};res[1].forEach(function(a){cnt[a.governorate]=(cnt[a.governorate]||0)+1;});
      var list=$('ar-list');list.innerHTML='';
      res[0].forEach(function(g){
        var n=cnt[g.governorate]||0,d=document.createElement('div');d.className='box';
        d.innerHTML='<div class="row"><div style="flex:2"><strong>'+esc(g.governorate)+'</strong> <span class="muted">'+n+' مدينة/منطقة</span></div>'+
          (n?'<div style="flex:0"><button class="btn red">مسح مناطقها</button></div>':'')+'</div>';
        var bt=d.querySelector('button');
        if(bt)bt.addEventListener('click',function(){
          if(!confirm('مسح كل مناطق '+g.governorate+'؟'))return;
          db('areas?governorate=eq.'+encodeURIComponent(g.governorate),{method:'DELETE',prefer:'return=minimal'}).then(function(){toast('تم المسح');loadAreas();}).catch(function(e){toast(e.message);});
        });
        list.appendChild(d);
      });
    }).catch(function(e){toast(e.message+' (اتأكد إنك شغلت supabase-shipping.sql)');});
  }
  $('ar-import').addEventListener('click',function(){
    var lines=$('ar-text').value.split(/\r?\n/),rows=[],bad=[],seen={};
    db('shipping_rates?select=governorate').then(function(gs){
      var known={};gs.forEach(function(g){known[g.governorate]=1;});
      lines.forEach(function(l){
        l=l.trim();if(!l)return;
        var parts=l.split(/\t|,|،|;/).map(function(x){return x.trim();});
        var id=parseInt(parts[parts.length-1],10);
        if(parts.length<3||isNaN(id)){if(/\d/.test(l)||parts.length>1)bad.push(l);return;}
        var gov=parts[0],name=parts.slice(1,-1).join(' ').trim();
        if(!known[gov]||!name){bad.push(l);return;}
        seen[gov+'|'+name]=1;
        rows.push({governorate:gov,name:name,company_area_id:id,active:true});
      });
      var uniq={};rows.forEach(function(r){uniq[r.governorate+'|'+r.name]=r;});rows=Object.keys(uniq).map(function(k){return uniq[k];});
      if(!rows.length){$('ar-msg').textContent=bad.length?'مفيش سطر صالح — الأسطر الغلط: '+bad.length:'الصق البيانات الأول';return;}
      var jobs=[],i;
      for(i=0;i<rows.length;i+=500)jobs.push(rows.slice(i,i+500));
      $('ar-msg').textContent='جاري الاستيراد...';
      return jobs.reduce(function(p,c){return p.then(function(){return db('areas?on_conflict=governorate,name',{method:'POST',prefer:'resolution=merge-duplicates,return=minimal',body:c});});},Promise.resolve())
        .then(function(){$('ar-msg').textContent='تم استيراد '+rows.length+(bad.length?' — اتجاهل '+bad.length+' سطر (محافظة مش معروفة أو شكل غلط): '+bad.slice(0,3).join(' | '):'');$('ar-text').value='';loadAreas();});
    }).catch(function(e){$('ar-msg').textContent=e.message;});
  });

  var poll=null;
  function start(){$('login').hidden=true;$('app').hidden=false;loadOrders();refreshNew();loadStats();clearInterval(poll);poll=setInterval(function(){if(session){refreshNew();loadStats();}},60000);}
  if(session)start();
})();
