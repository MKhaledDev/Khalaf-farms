(function(){
  var SB_URL = 'https://akcpicfbqyalgukxvkxd.supabase.co';
  var SB_KEY = 'sb_publishable__hekFZ-AwpL7hRWv3DHrlQ_jh73d-AW';
  var IMGS = {
    majhool: "assets/majhool.jpg",
    siwi: "assets/siwi.jpg"
  };

  // ===== helpers =====
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function sb(path, opts){
    opts = opts || {};
    return fetch(SB_URL + '/rest/v1/' + path, {
      method: opts.method || 'GET',
      headers: {'apikey': SB_KEY, 'Content-Type': 'application/json'},
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function(r){
      return r.json().catch(function(){ return null; }).then(function(data){
        if(!r.ok){ throw new Error((data && data.message) || 'حصلت مشكلة، جرب تاني'); }
        return data;
      });
    });
  }
  function todayCairo(){
    try { return new Date().toLocaleDateString('en-CA', {timeZone: 'Africa/Cairo'}); }
    catch(e){ return new Date().toISOString().slice(0,10); }
  }
  function hasOffer(p){
    return p.offer_price != null && (!p.offer_until || p.offer_until >= todayCairo());
  }
  function effPrice(p){ return hasOffer(p) ? p.offer_price : p.price; }
  function fmtDate(d){ var x = String(d).split('-'); return x[2] + '/' + x[1]; }

  // ===== Mobile nav =====
  var menuBtn = document.getElementById('menu-btn');
  var nav = document.getElementById('site-nav');
  if(menuBtn && nav){
    menuBtn.addEventListener('click', function(){ nav.classList.toggle('open'); });
    nav.querySelectorAll('[data-close]').forEach(function(el){
      el.addEventListener('click', function(){ nav.classList.remove('open'); });
    });
  }

  // ===== Reveal on scroll =====
  var revealEls = document.querySelectorAll('.reveal');
  if('IntersectionObserver' in window){
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting){ entry.target.classList.add('in'); io.unobserve(entry.target); }
      });
    }, {threshold:0.12});
    revealEls.forEach(function(el){ io.observe(el); });
  } else {
    revealEls.forEach(function(el){ el.classList.add('in'); });
  }

  // ===== State =====
  var products = [];
  var rates = [];
  var areas = [];
  var CART_KEY = 'khalaf_cart_v2';
  var cart = [];
  try { var saved = JSON.parse(sessionStorage.getItem(CART_KEY) || '[]'); if(Array.isArray(saved)) cart = saved; } catch(e){}
  function saveCart(){ try { sessionStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch(e){} }
  function prod(id){ return products.find(function(p){ return p.id === id; }); }
  function cartLines(){
    return cart.map(function(c){ var p = prod(c.id); return p ? {p: p, qty: c.qty, price: effPrice(p)} : null; })
               .filter(Boolean);
  }
  function subtotal(){ return cartLines().reduce(function(s, l){ return s + l.price * l.qty; }, 0); }
  function cartCount(){ return cartLines().reduce(function(s, l){ return s + l.qty; }, 0); }

  // ===== Load data =====
  function load(silent){
    var grid = document.getElementById('product-grid');
    if(!silent) grid.innerHTML = '<div class="load-msg">جاري تحميل المنتجات...</div>';
    return Promise.all([
      sb('products?select=*&active=eq.true&order=sort.asc'),
      sb('shipping_rates?select=*&active=eq.true&order=sort.asc'),
      sb('areas?select=id,governorate,name&active=eq.true&order=name.asc&limit=5000').catch(function(){ return []; })
    ]).then(function(res){
      products = res[0] || [];
      rates = res[1] || [];
      areas = res[2] || [];
      clampCart();
      saveCart();
      renderProducts(); renderOfferBanner(); fillGovernorates(); updateAreaField(); updateBadge();
    }).catch(function(){
      if(silent) return;
      grid.innerHTML = '<div class="load-msg">مقدرناش نحمل المنتجات دلوقتي.<br><button type="button" class="btn btn-outline" id="retry-btn">حاول تاني</button></div>';
      document.getElementById('retry-btn').addEventListener('click', function(){ load(); });
    });
  }

  // ===== Stock =====
  // stock == null  => غير محدود | 0 => نفذت | رقم => المتاح
  function maxFor(p){ return p.stock == null ? 50 : Math.max(0, Math.min(50, p.stock)); }
  function isSoldOut(p){ return p.stock != null && p.stock <= 0; }
  function isLow(p){ return p.stock != null && p.stock > 0 && p.stock <= (p.low_stock_at == null ? 5 : p.low_stock_at); }
  function clampCart(){
    cart = cart.filter(function(c){ var p = prod(c.id); return p && !isSoldOut(p); });
    cart.forEach(function(c){ c.qty = Math.min(c.qty, maxFor(prod(c.id))); });
  }

  function renderOfferBanner(){
    var el = document.getElementById('offer-banner');
    var offers = products.filter(hasOffer);
    if(!offers.length){ el.hidden = true; return; }
    var dates = offers.map(function(p){ return p.offer_until; }).filter(Boolean).sort();
    el.textContent = '🔥 عروض لفترة محدودة' + (dates.length ? ' — لحد ' + fmtDate(dates[0]) : '');
    el.hidden = false;
  }

  function renderProducts(){
    var grid = document.getElementById('product-grid');
    grid.innerHTML = '';
    if(!products.length){ grid.innerHTML = '<div class="load-msg">مفيش منتجات متاحة حاليا.</div>'; return; }
    var logoSrc = document.querySelector('.brand-logo').src;
    products.forEach(function(p){
      var card = document.createElement('div');
      var out = isSoldOut(p), low = isLow(p), maxQty = maxFor(p);
      card.className = 'product-card' + (out ? ' soldout' : '');
      var src = IMGS[p.image_key] || p.image_url || '';
      var offer = hasOffer(p);
      var badge = out ? '<span class="stock-badge out">نفذت الكمية</span>'
                : low ? '<span class="stock-badge low">متبقي ' + p.stock + ' فقط</span>'
                : '<span class="stock-badge in">متوفر</span>';
      card.innerHTML =
        '<div class="product-img-wrap">' +
          '<img ' + (src ? '' : 'class="ph" ') + 'src="' + esc(src || logoSrc) + '" alt="' + esc(p.name) + '">' +
          (offer && !out ? '<span class="offer-pill">' + (p.offer_until ? 'عرض لحد ' + fmtDate(p.offer_until) : 'عرض خاص') + '</span>' : '') +
          (out ? '<div class="soldout-pill">نفذت الكمية</div>' : '') +
        '</div>' +
        '<div class="product-body">' +
          '<h3>' + esc(p.name) + '</h3>' +
          '<div class="pweight">' + esc(p.subtitle || '') + '</div>' +
          badge +
          '<div class="price-row"><span class="price-now">' + effPrice(p) + ' جنيه</span>' +
            (offer ? '<span class="price-old">' + p.price + ' جنيه</span>' : '') + '</div>' +
          '<div class="qty-row">' +
            '<button type="button" class="qty-btn" data-action="minus"' + (out ? ' disabled' : '') + '>−</button>' +
            '<span class="qty-value" data-qty>' + (out ? 0 : 1) + '</span>' +
            '<button type="button" class="qty-btn" data-action="plus"' + (out ? ' disabled' : '') + '>+</button>' +
          '</div>' +
          '<button type="button" class="add-cart-btn" data-action="add"' + (out ? ' disabled' : '') + '>' + (out ? 'غير متاح حاليا' : 'أضف للعربة') + '</button>' +
        '</div>';
      if(!out){
        var qty = 1, qtyEl = card.querySelector('[data-qty]');
        card.querySelector('[data-action="minus"]').addEventListener('click', function(){ if(qty > 1){ qty--; qtyEl.textContent = qty; } });
        card.querySelector('[data-action="plus"]').addEventListener('click', function(){ if(qty < maxQty){ qty++; qtyEl.textContent = qty; } });
        var btn = card.querySelector('[data-action="add"]');
        btn.addEventListener('click', function(){
          var added = addToCart(p.id, qty);
          var label = added > 0 ? 'تمت الإضافة ✓' : 'وصلت لأقصى كمية متاحة';
          btn.textContent = label; btn.classList.add('added');
          setTimeout(function(){ btn.textContent = 'أضف للعربة'; btn.classList.remove('added'); }, 1400);
          qty = 1; qtyEl.textContent = 1;
        });
      }
      grid.appendChild(card);
    });
  }

  // ===== Cart =====
  function addToCart(id, qty){
    var p = prod(id); if(!p) return 0;
    var ex = cart.find(function(c){ return c.id === id; });
    var have = ex ? ex.qty : 0;
    var add = Math.max(0, Math.min(qty, maxFor(p) - have));
    if(add > 0){
      if(ex){ ex.qty += add; } else { cart.push({id: id, qty: add}); }
      saveCart(); renderCart(); updateBadge();
    }
    return add;
  }
  function changeQty(id, d){
    var it = cart.find(function(c){ return c.id === id; }), p = prod(id);
    if(!it || !p) return;
    it.qty = Math.min(maxFor(p), it.qty + d);
    if(it.qty <= 0) cart = cart.filter(function(c){ return c.id !== id; });
    saveCart(); renderCart(); updateBadge();
  }
  function updateBadge(){
    var badge = document.getElementById('cart-badge'), n = cartCount();
    badge.hidden = n <= 0; badge.textContent = n;
  }
  function renderCart(){
    var wrap = document.getElementById('cart-items-wrap');
    var lines = cartLines();
    var totalRow = document.getElementById('cart-total-row');
    var footer = document.getElementById('cart-footer-btns');
    var note = document.getElementById('cart-ship-note');
    wrap.innerHTML = '';
    if(!lines.length){
      wrap.innerHTML = '<div class="empty-cart-msg">العربة فاضية، اختار منتج من المنتجات والعروض</div>';
      totalRow.hidden = footer.hidden = note.hidden = true;
      return;
    }
    var logoSrc = document.querySelector('.brand-logo').src;
    lines.forEach(function(l){
      var row = document.createElement('div');
      row.className = 'cart-item';
      row.innerHTML =
        '<img src="' + esc(IMGS[l.p.image_key] || l.p.image_url || logoSrc) + '" alt="">' +
        '<div class="cart-item-info"><div class="ci-name">' + esc(l.p.name) + '</div>' +
        '<div class="ci-price">' + l.price + ' جنيه × ' + l.qty + ' = ' + (l.price * l.qty) + ' جنيه</div></div>' +
        '<div class="cart-item-qty"><button type="button" data-d="-1">−</button><span>' + l.qty + '</span><button type="button" data-d="1">+</button></div>';
      row.querySelectorAll('button').forEach(function(b){
        b.addEventListener('click', function(){ changeQty(l.p.id, parseInt(b.dataset.d, 10)); });
      });
      wrap.appendChild(row);
    });
    document.getElementById('cart-total-value').textContent = subtotal() + ' جنيه';
    totalRow.hidden = footer.hidden = note.hidden = false;
  }

  // ===== Modals =====
  function openModal(id){ document.getElementById(id).classList.add('open'); }
  function closeModal(id){ document.getElementById(id).classList.remove('open'); }
  function openCart(){ renderCart(); openModal('cart-overlay'); }
  document.getElementById('cart-btn').addEventListener('click', openCart);
  document.getElementById('nav-cart-btn').addEventListener('click', openCart);
  document.querySelectorAll('[data-close-modal]').forEach(function(btn){
    btn.addEventListener('click', function(){ btn.closest('.modal-overlay').classList.remove('open'); });
  });
  document.querySelectorAll('.modal-overlay').forEach(function(o){
    o.addEventListener('click', function(e){ if(e.target === o) o.classList.remove('open'); });
  });

  // ===== Checkout =====
  var govSel = document.getElementById('co-governorate');
  function fillGovernorates(){
    var cur = govSel.value;
    govSel.innerHTML = '<option value="">اختار المحافظة</option>';
    rates.forEach(function(r){
      var o = document.createElement('option');
      o.value = r.governorate; o.textContent = r.governorate;
      govSel.appendChild(o);
    });
    govSel.value = cur;
  }
  function shippingFor(g){
    var r = rates.find(function(x){ return x.governorate === g; });
    return r ? r.price : null;
  }
  function updateSummary(){
    var sub = subtotal(), ship = shippingFor(govSel.value);
    document.getElementById('sum-sub').textContent = sub + ' جنيه';
    document.getElementById('sum-ship').textContent = ship == null ? 'اختار المحافظة' : (ship === 0 ? 'مجاني' : ship + ' جنيه');
    document.getElementById('sum-total').textContent = (sub + (ship || 0)) + ' جنيه';
  }
  var areaSel = document.getElementById('co-area');
  function areasFor(g){ return areas.filter(function(a){ return a.governorate === g; }); }
  function updateAreaField(){
    var list = areasFor(govSel.value);
    var useSelect = list.length > 0;
    document.getElementById('area-field').hidden = !useSelect;
    document.getElementById('city-field').hidden = useSelect;
    areaSel.innerHTML = '<option value="">اختار المدينة / المنطقة</option>';
    list.forEach(function(a){
      var o = document.createElement('option');
      o.value = a.id; o.textContent = a.name;
      areaSel.appendChild(o);
    });
  }
  govSel.addEventListener('change', function(){ updateAreaField(); updateSummary(); });

  document.getElementById('go-checkout-btn').addEventListener('click', function(){
    if(!cartLines().length) return;
    document.getElementById('co-form').hidden = false;
    document.getElementById('co-done').hidden = true;
    document.getElementById('co-title').textContent = 'بيانات التوصيل';
    document.getElementById('checkout-error').classList.remove('show');
    updateSummary();
    closeModal('cart-overlay');
    openModal('checkout-overlay');
  });

  var confirmBtn = document.getElementById('checkout-confirm');
  confirmBtn.addEventListener('click', function(){
    var errEl = document.getElementById('checkout-error');
    function fail(m){ errEl.textContent = m; errEl.classList.add('show'); }
    var name = document.getElementById('co-name').value.trim();
    var phone = document.getElementById('co-phone').value.trim();
    var gov = govSel.value;
    var useArea = !document.getElementById('area-field').hidden;
    var areaId = useArea ? parseInt(areaSel.value, 10) : null;
    var city = useArea ? (areaSel.options[areaSel.selectedIndex] ? areaSel.options[areaSel.selectedIndex].textContent : '') : document.getElementById('co-city').value.trim();
    var address = document.getElementById('co-address').value.trim();
    var phone2 = document.getElementById('co-phone2').value.trim();
    var note = document.getElementById('co-note').value.trim();
    if(!name || !phone || !gov || !address || (useArea ? !areaId : !city)){ fail('من فضلك املا كل البيانات'); return; }
    var lines = cartLines();
    if(!lines.length){ fail('العربة فاضية'); return; }
    errEl.classList.remove('show');
    confirmBtn.disabled = true; confirmBtn.textContent = 'جاري إرسال الطلب...';
    sb('rpc/create_order', {method: 'POST', body: {
      p_name: name, p_phone: phone, p_governorate: gov, p_city: city, p_address: address,
      p_area_id: areaId, p_phone2: phone2 || null, p_note: note || null,
      p_items: lines.map(function(l){ return {id: l.p.id, qty: l.qty}; })
    }}).then(function(res){
      cart = []; saveCart(); updateBadge(); renderCart();
      document.getElementById('done-no').textContent = '#' + res.order_no;
      document.getElementById('done-total').textContent = res.total + ' جنيه';
      document.getElementById('co-title').textContent = 'تم الطلب';
      document.getElementById('co-form').hidden = true;
      document.getElementById('co-done').hidden = false;
      ['co-name','co-phone','co-phone2','co-city','co-address','co-note'].forEach(function(i){ document.getElementById(i).value = ''; });
      govSel.value = ''; updateAreaField();
    }).catch(function(e){
      fail(e && e.message ? e.message : 'حصلت مشكلة، جرب تاني');
      load(true);
    }).then(function(){
      confirmBtn.disabled = false; confirmBtn.textContent = 'تأكيد الطلب';
    });
  });

  updateBadge();
  load();
})();
