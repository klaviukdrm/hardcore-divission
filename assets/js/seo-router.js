(function () {
    const products = Array.isArray(window.PRODUCTS_DATA) ? window.PRODUCTS_DATA : [];
    const page = document.body && document.body.dataset ? document.body.dataset.page : "";
    const baseUrl = window.location.origin + window.location.pathname.replace(/[^/]*$/, "");
    let activeProduct = null;
    const storeSeoKeywords = "hardcore division, правий мерч україна, правый мерч украина, мілітарі одяг, милитари одежда, язичництво, pagan streetwear, hoodie, t-shirt, український бренд одягу";

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
        return `/pages/product.html?product=${encodeURIComponent(slug)}`;
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
        return `${product.title}. ${product.seoKeywords}. ${storeSeoKeywords}. Hardcore Division ${inferTypeName(product)} streetwear.`;
    }

    function getNewBadgeText() {
        return getLang() === "eng" ? "NEW" : "НОВЕ";
    }

    function buildProductSeoCopy(product) {
        const type = inferTypeName(product);
        const typeUa = type === "T-Shirt" ? "футболка" : "худі";
        const typeRu = type === "T-Shirt" ? "футболка" : "худи";
        const descUa = (product.descUa || product.descEng || product.title).trim();
        const descEng = (product.descEng || product.descUa || product.title).trim();

        return {
            ua: `Купити ${typeUa} ${product.title} від Hardcore Division. ${descUa} Правий мерч Україна, мілітарі одяг, streetwear, український бренд одягу.`,
            ru: `Купить ${typeRu} ${product.title} от Hardcore Division. ${descUa} Правый мерч Украина, милитари одежда, streetwear бренд.`,
            eng: `Buy ${product.title} ${type} by Hardcore Division. ${descEng} Streetwear clothing from a Ukrainian brand.`
        };
    }

    function enhanceCatalogCards() {
        const grid = document.querySelector(".shop-grid");
        const cards = Array.from(document.querySelectorAll(".shop-grid .product-card"));
        const lang = getLang();
        const cardItems = [];

        cards.forEach((card, index) => {
            const product = products[index];
            if (!product) return;
            cardItems.push({ card, product, index });

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

            const oldInfoBadge = card.querySelector(".product-info .product-new-badge");
            if (oldInfoBadge) {
                oldInfoBadge.remove();
            }

            const existingImageBadge = imgContainer ? imgContainer.querySelector(".product-new-badge") : null;
            if (product.isNew && imgContainer && !existingImageBadge) {
                const badge = document.createElement("span");
                badge.className = "product-new-badge product-new-badge-corner";
                badge.setAttribute("data-ua", "НОВЕ");
                badge.setAttribute("data-eng", "NEW");
                badge.textContent = getNewBadgeText(product);
                imgContainer.appendChild(badge);
            }
            if (!product.isNew && existingImageBadge) {
                existingImageBadge.remove();
            }

            if (!card.querySelector(".product-seo-hidden")) {
                const hidden = document.createElement("p");
                hidden.className = "seo-hidden product-seo-hidden";
                hidden.textContent = buildSeoLine(product);
                card.appendChild(hidden);
            }
        });

        if (grid && cardItems.length > 1) {
            const sorted = cardItems.slice().sort((a, b) => {
                const aNew = Boolean(a.product && a.product.isNew);
                const bNew = Boolean(b.product && b.product.isNew);
                if (aNew === bNew) return a.index - b.index;
                return aNew ? -1 : 1;
            });

            const changedOrder = sorted.some((item, idx) => item !== cardItems[idx]);
            if (changedOrder) {
                sorted.forEach((item) => {
                    grid.appendChild(item.card);
                });
            }
        }
    }

    function setupCatalogSeo() {
        const title = "HARDCORE DIVISION | ONLY BLOOD";
        const description = "Hardcore Division — правий мерч Україна: мілітарі одяг, худі та футболки у стилі streetwear.";
        const image = absUrl("images/photo_2026-03-07_18-15-01.jpg");

        document.title = title;
        setCanonical("/");
        setMetaName("description", description);
        setMetaName("keywords", storeSeoKeywords);
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
            "description": "Правий мерч Україна: мілітарі одяг, худі та футболки Hardcore Division.",
            "keywords": storeSeoKeywords,
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
            "description": "Правий мерч Україна, мілітарі одяг, худі та футболки Hardcore Division.",
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
        const productSeoCopy = buildProductSeoCopy(product);
        const newBadge = product.isNew
            ? `<span class="product-new-badge product-new-badge-corner product-new-badge-detail-corner" data-ua="НОВЕ" data-eng="NEW">${getNewBadgeText(product)}</span>`
            : "";

        const thumbs = imageGallery.map((img, idx) =>
            `<img src="${img}" alt="${product.title} view ${idx + 1}" data-idx="${idx}" loading="lazy" decoding="async">`
        ).join("");

        mount.innerHTML = `
            <div class="breadcrumbs">
                <a href="/pages/index.html">Catalog</a> / <span>${product.title}</span>
            </div>
            <article class="product-detail-card" itemscope itemtype="https://schema.org/Product">
                <div class="product-detail-media">
                    ${newBadge}
                    <img src="${mainImg}" id="productMainImage" class="product-detail-main-img" alt="${product.title} ${typeName}" loading="eager" decoding="async" itemprop="image">
                    <div class="product-detail-thumbs">${thumbs}</div>
                </div>
                <div class="product-detail-info">
                    <a href="/pages/index.html" class="product-detail-back">${backLabel}</a>
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
                <section class="seo-hidden" aria-label="Product search keywords">
                    <h2>${product.title} Hardcore Division</h2>
                    <p>${productSeoCopy.ua}</p>
                    <p>${productSeoCopy.ru}</p>
                    <p>${productSeoCopy.eng}</p>
                    <p>${seoKeywords}</p>
                </section>
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
            "url": absUrl("/pages/index.html"),
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
        setCanonical("/pages/product.html");
        mount.innerHTML = `
            <div class="product-detail-card">
                <div>
                    <h1 class="product-detail-title">Product not found</h1>
                    <p class="product-detail-desc">The product link is invalid or no longer available.</p>
                    <a class="product-detail-back" href="/pages/index.html">Back to catalog</a>
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


