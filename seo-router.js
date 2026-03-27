(function () {
    const products = Array.isArray(window.PRODUCTS_DATA) ? window.PRODUCTS_DATA : [];
    const page = document.body && document.body.dataset ? document.body.dataset.page : "";
    const baseUrl = window.location.origin + window.location.pathname.replace(/[^/]*$/, "");
    let activeProduct = null;

    function absUrl(path) {
        try {
            return new URL(path, baseUrl).toString();
        } catch (e) {
            return path;
        }
    }

    function getLang() {
        return localStorage.getItem("preferred_lang") || "ua";
    }

    function productUrl(slug) {
        return `product.html?product=${encodeURIComponent(slug)}`;
    }

    function productAbsUrl(slug) {
        return absUrl(productUrl(slug));
    }

    function setCanonical(path) {
        const el = document.getElementById("canonicalLink");
        if (!el) return;
        el.setAttribute("href", absUrl(path));
    }

    function ensureMeta(attrName, attrValue) {
        let meta = document.head.querySelector(`meta[${attrName}="${attrValue}"]`);
        if (!meta) {
            meta = document.createElement("meta");
            meta.setAttribute(attrName, attrValue);
            document.head.appendChild(meta);
        }
        return meta;
    }

    function setMetaName(name, content) {
        const meta = ensureMeta("name", name);
        meta.setAttribute("content", content);
    }

    function setMetaProperty(property, content) {
        const meta = ensureMeta("property", property);
        meta.setAttribute("content", content);
    }

    function setJsonLd(id, data) {
        let script = document.getElementById(id);
        if (!script) {
            script = document.createElement("script");
            script.type = "application/ld+json";
            script.id = id;
            document.head.appendChild(script);
        }
        script.textContent = JSON.stringify(data);
    }

    function inferTypeName(product) {
        return /t-?shirt/i.test(product.cartName) ? "T-Shirt" : "Hoodie";
    }

    function getSizeGuideImage(product) {
        return inferTypeName(product) === "T-Shirt"
            ? "images/Screenshot_198.png"
            : "images/Screenshot_197.png";
    }

    function formatPriceLabel(product, lang) {
        return lang === "ua" ? `${product.priceUah}\u20B4` : `${product.priceUsd}$`;
    }

    function buildSeoLine(product) {
        return `${product.title}. ${product.seoKeywords}. Hardcore Division ${inferTypeName(product)} streetwear.`;
    }

    function enhanceCatalogCards() {
        const cards = document.querySelectorAll(".shop-grid .product-card");
        const lang = getLang();
        cards.forEach((card, index) => {
            const product = products[index];
            if (!product) return;

            const url = productUrl(product.slug);
            card.setAttribute("data-product-slug", product.slug);

            const imgContainer = card.querySelector(".product-img-container");
            if (imgContainer) {
                imgContainer.removeAttribute("onclick");
                if (!imgContainer.closest("a.product-link")) {
                    const link = document.createElement("a");
                    link.className = "product-link";
                    link.href = url;
                    link.setAttribute("aria-label", `Open ${product.title}`);
                    imgContainer.parentNode.insertBefore(link, imgContainer);
                    link.appendChild(imgContainer);
                }
            }

            const primaryImg = card.querySelector(".product-img");
            if (primaryImg) {
                primaryImg.alt = `${product.title} ${inferTypeName(product)} front`;
            }
            const altImg = card.querySelector(".product-img-alt");
            if (altImg) {
                altImg.alt = `${product.title} ${inferTypeName(product)} second view`;
            }

            const title = card.querySelector(".product-title");
            if (title && !title.querySelector("a")) {
                const text = title.textContent.trim();
                title.textContent = "";
                const link = document.createElement("a");
                link.className = "product-title-link";
                link.href = url;
                link.textContent = text;
                title.appendChild(link);
            }

            if (!card.querySelector(".product-seo-hidden")) {
                const hidden = document.createElement("p");
                hidden.className = "seo-hidden product-seo-hidden";
                hidden.textContent = buildSeoLine(product);
                card.appendChild(hidden);
            }
        });
    }

    function setupCatalogSeo() {
        const title = "HARDCORE DIVISION | ONLY BLOOD";
        const description = "Official Hardcore Division catalog: hoodies and t-shirts with hardcore streetwear identity.";
        const image = absUrl("images/photo_2026-03-07_18-15-01.jpg");

        document.title = title;
        setCanonical("/");
        setMetaName("description", description);
        setMetaName("keywords", "hardcore division, streetwear, hoodie, t-shirt, ukrainian brand, hardcore clothing");
        setMetaName("robots", "index, follow, max-image-preview:large");
        setMetaName("googlebot", "index, follow, max-image-preview:large");
        setMetaProperty("og:title", title);
        setMetaProperty("og:description", description);
        setMetaProperty("og:image", image);
        setMetaProperty("og:image:alt", "Hardcore Division clothing catalog preview");
        setMetaProperty("og:url", absUrl("/"));
        setMetaName("twitter:title", title);
        setMetaName("twitter:description", description);
        setMetaName("twitter:image", image);
        setMetaName("twitter:image:alt", "Hardcore Division clothing catalog preview");

        setJsonLd("org-jsonld", {
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "Hardcore Division",
            "url": absUrl("/"),
            "logo": image,
            "sameAs": [
                "https://t.me/hardcore_divis1on",
                "https://www.instagram.com/hardcore_division_brand",
                "https://www.tiktok.com/@hardcore.division"
            ]
        });

        setJsonLd("catalog-jsonld", {
            "@context": "https://schema.org",
            "@type": "ItemList",
            "name": "Hardcore Division Catalog",
            "itemListOrder": "https://schema.org/ItemListOrderAscending",
            "numberOfItems": products.length,
            "itemListElement": products.map((product, index) => ({
                "@type": "ListItem",
                "position": index + 1,
                "name": product.title,
                "url": productAbsUrl(product.slug)
            }))
        });
    }

    function renderProduct(product) {
        const mount = document.getElementById("productMount");
        if (!mount) return;

        const lang = getLang();
        const imageGallery = Array.isArray(product.gallery) ? product.gallery : [];
        const mainImg = imageGallery.length ? imageGallery[0] : product.image;
        const desc = lang === "ua" ? (product.descUa || product.descEng) : (product.descEng || product.descUa);
        const typeName = inferTypeName(product);
        const addLabel = lang === "ua" ? "\u0414\u041E\u0414\u0410\u0422\u0418 \u0412 \u041A\u041E\u0428\u0418\u041A" : "ADD TO CART";
        const backLabel = lang === "ua" ? "\u041D\u0430\u0437\u0430\u0434 \u0434\u043E \u043A\u0430\u0442\u0430\u043B\u043E\u0433\u0443" : "Back to catalog";
        const sizeGuideLabel = lang === "ua" ? "\u0420\u043E\u0437\u043C\u0456\u0440\u043D\u0430 \u0441\u0456\u0442\u043A\u0430" : "Size guide";
        const slugLabel = lang === "ua" ? "\u0410\u0440\u0442\u0438\u043A\u0443\u043B" : "SKU";
        const seoKeywords = buildSeoLine(product);

        const thumbs = imageGallery.map((img, idx) =>
            `<img src="${img}" alt="${product.title} view ${idx + 1}" data-idx="${idx}" loading="lazy" decoding="async">`
        ).join("");

        mount.innerHTML = `
            <div class="breadcrumbs">
                <a href="index.html">Catalog</a> / <span>${product.title}</span>
            </div>
            <article class="product-detail-card" itemscope itemtype="https://schema.org/Product">
                <div class="product-detail-media">
                    <img src="${mainImg}" id="productMainImage" class="product-detail-main-img" alt="${product.title} ${typeName}" loading="eager" decoding="async" itemprop="image">
                    <div class="product-detail-thumbs">${thumbs}</div>
                </div>
                <div class="product-detail-info">
                    <a href="index.html" class="product-detail-back">${backLabel}</a>
                    <h1 class="product-detail-title" itemprop="name">${product.title}</h1>
                    <p class="product-detail-meta"><strong>${slugLabel}:</strong> ${product.slug}</p>
                    <p class="product-detail-desc" itemprop="description">${desc}</p>
                    <div class="price" id="productPrice" data-uah="${product.priceUah}\u20B4" data-usd="${product.priceUsd}$">${formatPriceLabel(product, lang)}</div>
                    <div class="product-detail-actions">
                        <select id="product-size">
                            <option value="S">SIZE: S</option>
                            <option value="M">SIZE: M</option>
                            <option value="L">SIZE: L</option>
                            <option value="XL">SIZE: XL</option>
                            <option value="2XL">SIZE: 2XL</option>
                            <option value="3XL">SIZE: 3XL</option>
                        </select>
                        <button class="buy-btn" id="addProductBtn">${addLabel}</button>
                        <button class="buy-btn" id="sizeGuideBtn" style="margin-top:10px; background:#111; border:1px solid #333;">${sizeGuideLabel}</button>
                    </div>
                    <div class="product-detail-filler-art" aria-hidden="true">
                        <img src="images/photo_2026-03-13_20-42-54.png" alt="">
                    </div>
                </div>
                <p class="seo-hidden">${seoKeywords}</p>
            </article>
        `;

        const btn = document.getElementById("addProductBtn");
        if (btn) {
            btn.addEventListener("click", function () {
                addToCart(product.cartName, product.priceUah, product.priceUsd, "product-size");
            });
        }

        const mainImageNode = document.getElementById("productMainImage");
        if (mainImageNode) {
            mainImageNode.addEventListener("click", function () {
                if (typeof openGallery === "function") {
                    openGallery(imageGallery);
                }
            });
        }

        const sizeGuideBtn = document.getElementById("sizeGuideBtn");
        if (sizeGuideBtn) {
            sizeGuideBtn.addEventListener("click", function () {
                if (typeof openGallery === "function") {
                    openGallery([getSizeGuideImage(product)]);
                }
            });
        }

        const thumbNodes = mount.querySelectorAll(".product-detail-thumbs img");
        thumbNodes.forEach((thumb) => {
            thumb.addEventListener("click", function () {
                if (!mainImageNode) return;
                mainImageNode.src = thumb.getAttribute("src");
            });
        });
    }

    function setupProductSeo(product) {
        const title = `${product.title} | Hardcore Division`;
        const description = (product.descEng || product.descUa || product.title).slice(0, 180);
        const image = absUrl((product.gallery && product.gallery[0]) || product.image);
        const pageLink = productUrl(product.slug);

        document.title = title;
        setCanonical(pageLink);
        setMetaName("description", description);
        setMetaName("keywords", `${product.seoKeywords}, buy ${product.title}, hardcore division ${inferTypeName(product).toLowerCase()}`);
        setMetaName("robots", "index, follow, max-image-preview:large");
        setMetaProperty("og:type", "product");
        setMetaProperty("og:title", title);
        setMetaProperty("og:description", description);
        setMetaProperty("og:image", image);
        setMetaProperty("og:image:alt", `${product.title} ${inferTypeName(product)} preview`);
        setMetaProperty("og:url", absUrl(pageLink));
        setMetaName("twitter:title", title);
        setMetaName("twitter:description", description);
        setMetaName("twitter:image", image);
        setMetaName("twitter:image:alt", `${product.title} ${inferTypeName(product)} preview`);

        setJsonLd("org-jsonld", {
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "Hardcore Division",
            "url": absUrl("index.html"),
            "logo": absUrl("images/photo_2026-03-07_18-15-01.jpg"),
            "sameAs": [
                "https://t.me/hardcore_divis1on",
                "https://www.instagram.com/hardcore_division_brand",
                "https://www.tiktok.com/@hardcore.division"
            ]
        });

        setJsonLd("catalog-jsonld", {
            "@context": "https://schema.org",
            "@type": "Product",
            "name": product.title,
            "sku": product.slug,
            "description": product.descEng || product.descUa || product.title,
            "image": (product.gallery || [product.image]).map(absUrl),
            "brand": {
                "@type": "Brand",
                "name": "Hardcore Division"
            },
            "offers": {
                "@type": "Offer",
                "priceCurrency": "UAH",
                "price": String(product.priceUah),
                "url": productAbsUrl(product.slug),
                "availability": "https://schema.org/InStock",
                "itemCondition": "https://schema.org/NewCondition"
            }
        });
    }

    function showNotFound() {
        const mount = document.getElementById("productMount");
        if (!mount) return;
        document.title = "Product Not Found | Hardcore Division";
        setMetaName("robots", "noindex, nofollow");
        setCanonical("product.html");
        mount.innerHTML = `
            <div class="product-detail-card">
                <div>
                    <h1 class="product-detail-title">Product not found</h1>
                    <p class="product-detail-desc">The product link is invalid or no longer available.</p>
                    <a class="product-detail-back" href="index.html">Back to catalog</a>
                </div>
            </div>
        `;
    }

    function initCatalogPage() {
        if (!products.length) return;
        enhanceCatalogCards();
        setupCatalogSeo();
    }

    function initProductPage() {
        if (!products.length) {
            showNotFound();
            return;
        }
        const slug = new URLSearchParams(window.location.search).get("product");
        const product = products.find((item) => item.slug === slug);
        if (!product) {
            showNotFound();
            return;
        }
        activeProduct = product;
        renderProduct(product);
        setupProductSeo(product);
    }

    function init() {
        if (page === "catalog") {
            initCatalogPage();
            return;
        }
        if (page === "product") {
            initProductPage();
        }
    }

    document.addEventListener("languageChanged", function () {
        if (page === "product" && activeProduct) {
            renderProduct(activeProduct);
        }
    });

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();


