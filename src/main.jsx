import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { supabase } from './lib/supabase';
import './styles.css';

const menu = ['Tableau de bord', 'Produits', 'Ventes', 'Retours', 'Boutiques', 'Équipe', 'Rapports', 'Paramètres'];

function App() {
  const [session, setSession] = useState(null);
  const [active, setActive] = useState('Tableau de bord');
  const [business, setBusiness] = useState(null);
  const [boutiques, setBoutiques] = useState([]);
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session);
        if (!data.session) setLoading(false);
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) {
        setBusiness(null);
        setBoutiques([]);
        setProducts([]);
        setSales([]);
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session?.user) loadWorkspace(session.user.id);
  }, [session]);

  async function loadWorkspace(userId) {
    setLoading(true);
    setError('');
    try {
      const { data: businesses, error: bError } = await supabase
        .from('businesses')
        .select('*')
        .eq('owner_id', userId)
        .order('created_at', { ascending: true })
        .limit(1);
      if (bError) throw bError;

      if (!businesses?.length) {
        setBusiness(null);
        setLoading(false);
        return;
      }

      const current = businesses[0];
      setBusiness(current);

      const [boutiquesRes, productsRes, salesRes] = await Promise.all([
        supabase.from('boutiques').select('*').eq('business_id', current.id).order('created_at'),
        supabase.from('products').select('*').eq('business_id', current.id).order('created_at', { ascending: false }),
        supabase.from('sales').select('*').eq('business_id', current.id).order('created_at', { ascending: false }).limit(50)
      ]);

      if (boutiquesRes.error) throw boutiquesRes.error;
      if (productsRes.error) throw productsRes.error;
      if (salesRes.error) throw salesRes.error;

      setBoutiques(boutiquesRes.data || []);
      setProducts(productsRes.data || []);
      setSales(salesRes.data || []);
    } catch (e) {
      setError(e.message || 'Impossible de charger vos données.');
    } finally {
      setLoading(false);
    }
  }

  if (!session) return <AuthScreen />;
  if (loading) return <div className="loading-screen">Chargement de SmartStock Pro…</div>;
  if (!business) return <BusinessSetup user={session.user} onCreated={() => loadWorkspace(session.user.id)} />;

  const totalStock = products.reduce((sum, p) => sum + (Number(p.qty) || 0), 0);
  const today = new Date().toISOString().slice(0, 10);
  const todaySales = sales.filter(s => String(s.created_at).slice(0, 10) === today);
  const revenueToday = todaySales.reduce((sum, s) => sum + (Number(s.total) || 0), 0);
  const lowStock = products.filter(p => Number(p.qty) <= Number(p.min_stock)).length;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">S</span><div><strong>SmartStock</strong><small>PRO</small></div></div>
        <div className="shop">🏪 <span>{business.name}</span><b>{boutiques.length} boutique{boutiques.length > 1 ? 's' : ''}</b></div>
        <nav>{menu.map(item => <button key={item} className={active === item ? 'active' : ''} onClick={() => setActive(item)}>{item}</button>)}</nav>
        <div className="side-footer"><div className="avatar">{(session.user.email || 'U')[0].toUpperCase()}</div><div><strong>{session.user.email}</strong><small>Administrateur</small></div></div>
      </aside>

      <main className="main">
        <header className="topbar"><div><span className="eyebrow">SMARTSTOCK PRO</span><h1>{active}</h1></div><button className="profile" onClick={() => supabase.auth.signOut()}>Déconnexion</button></header>
        <section className="content">
          {error && <div className="alert">{error}</div>}
          {active === 'Tableau de bord' ? (
            <>
              <div className="welcome"><div><h2>Bonjour 👋</h2><p>Voici l'état réel de votre activité.</p></div><button className="primary" onClick={() => setActive('Produits')}>Gérer les produits</button></div>
              <div className="cards">
                <div className="card"><span>Stock total</span><strong>{totalStock.toLocaleString('fr-FR')}</strong><small>unités disponibles</small></div>
                <div className="card"><span>Produits</span><strong>{products.length}</strong><small>références</small></div>
                <div className="card"><span>Ventes du jour</span><strong>{revenueToday.toLocaleString('fr-FR')} FCFA</strong><small>{todaySales.length} transaction{todaySales.length > 1 ? 's' : ''}</small></div>
                <div className="card"><span>Stock faible</span><strong>{lowStock}</strong><small>à surveiller</small></div>
              </div>
              <div className="panel"><div className="panel-head"><div><h3>Produits récents</h3><p>Données synchronisées avec Supabase</p></div><button onClick={() => setActive('Produits')}>Voir tout →</button></div><ProductTable products={products} /></div>
            </>
          ) : active === 'Produits' ? <Products products={products} boutiques={boutiques} business={business} refresh={() => loadWorkspace(session.user.id)} /> :
            <div className="panel empty"><div className="empty-icon">🚧</div><h2>{active}</h2><p>Cette section sera connectée aux opérations réelles dans la prochaine étape.</p><button className="primary" onClick={() => setActive('Tableau de bord')}>Retour au tableau de bord</button></div>}
        </section>
      </main>
    </div>
  );
}

function AuthScreen() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(e) {
    e.preventDefault(); setBusy(true); setMessage('');
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
        if (error) throw error;
        setMessage('Compte créé. Vérifiez votre e-mail si la confirmation est activée.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e) { setMessage(e.message || 'Erreur de connexion.'); }
    finally { setBusy(false); }
  }

  return <div className="auth-screen"><form className="auth-card" onSubmit={submit}><div className="auth-brand"><span className="brand-mark">S</span><div><strong>SmartStock</strong><small>PRO</small></div></div><h1>{mode === 'login' ? 'Connexion' : 'Créer mon compte'}</h1>{mode === 'signup' && <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Nom complet" required /> }<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail" required /><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mot de passe (6 caractères minimum)" minLength="6" required /><button className="primary" disabled={busy}>{busy ? 'Traitement…' : mode === 'login' ? 'Se connecter' : 'Créer le compte'}</button>{message && <div className="notice">{message}</div>}<button type="button" className="link-button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMessage(''); }}>{mode === 'login' ? 'Créer un compte' : 'J’ai déjà un compte'}</button></form></div>;
}

function BusinessSetup({ user, onCreated }) {
  const [name, setName] = useState('');
  const [country, setCountry] = useState('Cameroun');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function createBusiness(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const code = 'SS-' + Math.random().toString(36).slice(2, 8).toUpperCase();
      const { data, error: bError } = await supabase.from('businesses').insert({ owner_id: user.id, name, code, country, currency: 'XAF', phone: phone || null }).select().single();
      if (bError) throw bError;
      const { error: boutiqueError } = await supabase.from('boutiques').insert({ business_id: data.id, name: name + ' - Boutique principale', code: code + '-B1' });
      if (boutiqueError) throw boutiqueError;
      onCreated();
    } catch (e) { setError(e.message || 'Impossible de créer votre activité.'); }
    finally { setBusy(false); }
  }

  return <div className="auth-screen"><form className="auth-card" onSubmit={createBusiness}><div className="auth-brand"><span className="brand-mark">S</span><div><strong>SmartStock</strong><small>PRO</small></div></div><h1>Configurez votre commerce</h1><p className="muted">Ces informations servent à créer votre espace sécurisé.</p><input value={name} onChange={e => setName(e.target.value)} placeholder="Nom du commerce" required /><input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Téléphone (optionnel)" /><select value={country} onChange={e => setCountry(e.target.value)}><option>Cameroun</option><option>Gabon</option><option>Côte d’Ivoire</option><option>Bénin</option><option>Togo</option></select><button className="primary" disabled={busy}>{busy ? 'Création…' : 'Créer mon espace'}</button>{error && <div className="alert">{error}</div>}</form></div>;
}

function Products({ products, boutiques, business, refresh }) {
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ name:'', purchase_price:'', sale_price:'', qty:'', min_stock:'5', boutique_id:boutiques[0]?.id || '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const addProduct = async e => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      if (!form.boutique_id) throw new Error('Créez d’abord une boutique.');
      const payload = { business_id: business.id, boutique_id: form.boutique_id, name: form.name, purchase_price: Number(form.purchase_price), sale_price: Number(form.sale_price), qty: Number(form.qty), min_stock: Number(form.min_stock) };
      const { error } = await supabase.from('products').insert(payload);
      if (error) throw error;
      setShow(false); setForm({ name:'', purchase_price:'', sale_price:'', qty:'', min_stock:'5', boutique_id:boutiques[0]?.id || '' }); refresh();
    } catch (e) { setError(e.message || 'Impossible d’ajouter le produit.'); }
    finally { setBusy(false); }
  };

  return <div className="panel"><div className="panel-head"><div><h3>Produits</h3><p>{products.length} produit{products.length > 1 ? 's' : ''} enregistré{products.length > 1 ? 's' : ''}</p></div><button className="primary" onClick={() => setShow(!show)}>+ Ajouter</button></div>{show && <form className="product-form" onSubmit={addProduct}><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Nom du produit" required /><input type="number" value={form.purchase_price} onChange={e=>setForm({...form,purchase_price:e.target.value})} placeholder="Prix d'achat" required min="0" /><input type="number" value={form.sale_price} onChange={e=>setForm({...form,sale_price:e.target.value})} placeholder="Prix de vente" required min="0" /><input type="number" value={form.qty} onChange={e=>setForm({...form,qty:e.target.value})} placeholder="Quantité" required min="0" /><input type="number" value={form.min_stock} onChange={e=>setForm({...form,min_stock:e.target.value})} placeholder="Seuil d'alerte" min="0" /><select value={form.boutique_id} onChange={e=>setForm({...form,boutique_id:e.target.value})}>{boutiques.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select><button className="primary" disabled={busy}>{busy?'Enregistrement…':'Enregistrer'}</button>{error&&<div className="alert">{error}</div>}</form>}<ProductTable products={products} /></div>;
}

function ProductTable({ products }) {
  return <div className="table-wrap"><table><thead><tr><th>Produit</th><th>Stock</th><th>Prix de vente</th><th>État</th></tr></thead><tbody>{products.map(p => <tr key={p.id}><td><strong>{p.name}</strong></td><td>{p.qty}</td><td>{Number(p.sale_price).toLocaleString('fr-FR')} FCFA</td><td><span className={'badge ' + (Number(p.qty) === 0 ? 'danger' : Number(p.qty) <= Number(p.min_stock) ? 'warning' : 'success')}>{Number(p.qty) === 0 ? 'Rupture' : Number(p.qty) <= Number(p.min_stock) ? 'Stock faible' : 'En stock'}</span></td></tr>)}</tbody></table></div>;
}

createRoot(document.getElementById('root')).render(<App />);
