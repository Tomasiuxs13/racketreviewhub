// Brands Listing Page Functionality

document.addEventListener('DOMContentLoaded', function() {
  const brandsGrid = document.getElementById('brands-grid');
  if (!brandsGrid) return;

  // Brand articles data
  const brandArticles = [
    {
      name: "Bullpadel",
      url: "/articles/best-lists/best-padel-rackets-bullpadel.html",
      image: "/images/products/bullpadel-hack-03.jpg",
      description: "Discover the best Bullpadel rackets of 2025. Expert-tested reviews of top Bullpadel rackets for all skill levels."
    },
    {
      name: "Head",
      url: "/articles/best-lists/best-padel-rackets-head.html",
      image: "/images/products/head-delta-pro.jpg",
      description: "Discover the best Head rackets of 2025. Expert-tested reviews of top Head rackets for all skill levels."
    },
    {
      name: "Adidas",
      url: "/articles/best-lists/best-padel-rackets-adidas.html",
      image: "/images/products/adidas-metalbone-ctrl-3.3.jpg",
      description: "Discover the best Adidas rackets of 2025. Expert-tested reviews of top Adidas rackets for all skill levels."
    },
    {
      name: "Nox",
      url: "/articles/best-lists/best-padel-rackets-nox.html",
      image: "/images/products/nox-at10-genius-arena.jpg",
      description: "Discover the best Nox rackets of 2025. Expert-tested reviews of top Nox rackets for all skill levels."
    },
    {
      name: "Siux",
      url: "/articles/best-lists/best-padel-rackets-siux.html",
      image: "/images/products/siux-diablo-revolution.jpg",
      description: "Discover the best Siux rackets of 2025. Expert-tested reviews of top Siux rackets for all skill levels."
    },
    {
      name: "Wilson",
      url: "/articles/best-lists/best-padel-rackets-wilson.html",
      image: "/images/placeholders/product-placeholder.jpg",
      description: "Discover the best Wilson rackets of 2025. Expert-tested reviews of top Wilson rackets for all skill levels."
    }
  ];

  // Render brand cards
  let html = '';
  brandArticles.forEach(brand => {
    html += `
      <article class="review-card">
        <img src="${brand.image}" alt="Best ${brand.name} Rackets" class="review-card-image" onerror="this.src='/images/placeholders/product-placeholder.jpg'">
        <div class="review-card-info">
          <p class="review-card-brand">${brand.name}</p>
          <h3 class="review-card-title">Best ${brand.name} Rackets of 2025</h3>
          <p class="review-card-player">${brand.description}</p>
        </div>
        <a href="${brand.url}" class="review-card-link"></a>
      </article>
    `;
  });

  brandsGrid.innerHTML = html;
});






