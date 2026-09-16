import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const initialProducts = [
  { id: 1, name: 'Produit exemple', stock: 24, price: 2500, status: 'En stock' },
  { id: 2, name: 'Article boutique', stock: 8, price: 5000, status: 'Stock faible' },
  { id: 3, name: 'Nouveau produit', stock: 0, price: 3500, status: 'Rupture' },
];

function App() {
  const [active, setActive] = useState('Tableau de bord');
  const [products] = useState(initialProducts);
  const totalStock = products.reduce((sum, p) => sum + p.stock, 0);

  const menu = ['Tableau de bord', 'Produits', 'Ventes', 'Retours', 'Boutiques', 'Équipe', 'Rapports', 'Paramètres'];

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">S</span><div><strong>SmartStock</strong><small>PRO</small></div></div>
        <div className="shop">🏪 <span>Ma boutique</span><b>⌄</b></div>
        <nav>{menu.map(item => <button key={item} className={active === item ? 'active' : ''} onClick={() => setActive(item)}>{item}</button>)}</nav>
        <div className="side-footer"><div className="avatar">P</div><div><strong>Patron</strong><small>Administrateur</small></div></div>
      </aside>

      <main className="main">
        <header className="topbar"><div><span className="eyebrow">SMARTSTOCK PRO</span><h1>{active}</h1></div><button className="profile">P <span>Mon compte</span>⌄</button></header>

        <section className="content">
          {active === 'Tableau de bord' ? <>
            <div className="welcome"><div><h2>Bonjour 👋</h2><p>Voici l'état de votre activité aujourd'hui.</p></div><button className="primary" onClick={() => setActive('Produits')}>+ Ajouter un produit</button></div>
            <div className="cards">
              <div className="card"><span>Stock total</span><strong>{totalStock}</strong><small>unités disponibles</small></div>
              <div className="card"><span>Produits</span><strong>{products.length}</strong><small>références</small></div>
              <div className="card"><span>Ventes du jour</span><strong>0 FCFA</strong><small>Aucune vente enregistrée</small></div>
              <div className="card"><span>Stock faible</span><strong>{products.filter(p => p.stock > 0 && p.stock <= 10).length}</strong><small>à surveiller</small></div>
            </div>
            <div className="panel"><div className="panel-head"><div><h3>Produits récents</h3><p>Vue rapide de votre stock</p></div><button onClick={() => setActive('Produits')}>Voir tout →</button></div><ProductTable products={products} /></div>
          </> : <div className="panel empty"><div className="empty-icon">📦</div><h2>{active}</h2><p>Cette section est prête pour être connectée aux données Supabase de SmartStock Pro.</p><button className="primary" onClick={() => setActive('Tableau de bord')}>Retour au tableau de bord</button></div>}
        </section>
      </main>
    </div>
  );
}

function ProductTable({ products }) {
  return <div className="table-wrap"><table><thead><tr><th>Produit</th><th>Stock</th><th>Prix unitaire</th><th>État</th></tr></thead><tbody>{products.map(p => <tr key={p.id}><td><strong>{p.name}</strong></td><td>{p.stock}</td><td>{p.price.toLocaleString('fr-FR')} FCFA</td><td><span className={'badge ' + (p.stock === 0 ? 'danger' : p.stock <= 10 ? 'warning' : 'success')}>{p.status}</span></td></tr>)}</tbody></table></div>;
}

createRoot(document.getElementById('root')).render(<App />);
