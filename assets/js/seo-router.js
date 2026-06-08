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

    function getDisplayProductTitle(product, lang) {
        const title = String(product && product.title ? product.title : "");
        const targetLang = lang || getLang();
        if (targetLang === "eng") {
            return title.replace("[2 КОЛОРА]", "[2 COLORS]");
        }
        return title.replace("[2 COLORS]", "[2 КОЛОРА]");
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
        const category = String(product && product.category ? product.category : "").toLowerCase();
        const cartName = String(product && product.cartName ? product.cartName : "");
        if (category.includes("кепк") || /cap/i.test(cartName)) {
            return "Cap";
        }
        if (category === "лонгсліви" || /longsleeve|longlsleeve/i.test(cartName)) {
            return "Longsleeve";
        }
        if (category === "світшоти" || /sweatshirt/i.test(cartName)) {
            return "Sweatshirt";
        }
        return /t-?shirt/i.test(cartName) ? "T-Shirt" : "Hoodie";
    }

    function getSizeGuideImage(product) {
        const type = inferTypeName(product);
        if (type === "T-Shirt") return "images/Screenshot_198.png";
        if (type === "Cap") return "images/Screenshot_198.png";
        if (type === "Longsleeve") return "images/ChatGPT Image.png";
        if (type === "Sweatshirt") return "images/ChatGPT Image.png";
        return "images/Screenshot_197.png";
    }

    function getProductColorVariants(product) {
        const hasColorMarker = String(product && product.title ? product.title : "").includes("[2 КОЛОРА]");
        if (!hasColorMarker || !Array.isArray(product && product.colorVariants)) return [];
        return product.colorVariants.filter((variant) => Array.isArray(variant && variant.gallery) && variant.gallery.length);
    }

    function getColorVariantGallery(variant) {
        return Array.isArray(variant && variant.gallery) ? variant.gallery.filter(Boolean) : [];
    }

    function buildProductThumbs(product, gallery) {
        return gallery.map((img, idx) =>
            `<img src="${img}" alt="${product.title} view ${idx + 1}" data-idx="${idx}" loading="lazy" decoding="async">`
        ).join("");
    }

    function buildColorOptions(colorVariants, lang) {
        const colorLabel = lang === "ua" ? "КОЛОР" : "COLOR";
        return colorVariants.map((variant, index) => {
            const variantValue = variant && variant.value ? String(variant.value) : String(index);
            const variantLabel = lang === "ua"
                ? (variant.labelUa || variant.labelEng || variantValue)
                : (variant.labelEng || variant.labelUa || variantValue);
            return `<option value="${variantValue}">${colorLabel}: ${variantLabel}</option>`;
        }).join("");
    }

    function buildColorVariantCartName(product, variant) {
        const baseCartName = String(product && product.cartName ? product.cartName : product && product.title ? product.title : "").trim();
        const colorLabel = String(variant && (variant.labelEng || variant.value) ? (variant.labelEng || variant.value) : "").trim().toUpperCase();
        if (!baseCartName || !colorLabel) return baseCartName;
        const strippedBase = baseCartName.replace(/\s+(black|white|red)$/i, "").trim();
        return `${strippedBase} ${colorLabel}`.trim();
    }

    function buildCatalogAddToCartOnClick(product, sizeId) {
        const colorVariants = getProductColorVariants(product);
        const defaultVariant = colorVariants.length ? colorVariants[0] : null;
        const defaultGallery = defaultVariant ? getColorVariantGallery(defaultVariant) : [];
        const cartName = defaultVariant ? buildColorVariantCartName(product, defaultVariant) : product.cartName;
        const meta = {
            image: defaultGallery[0] || product.image || "",
            productSlug: product.slug || "",
            color: defaultVariant && defaultVariant.value ? String(defaultVariant.value) : ""
        };

        return `addToCart(${JSON.stringify(cartName)}, ${Number(product.priceUah) || 0}, ${Number(product.priceUsd) || 0}, ${JSON.stringify(sizeId)}, ${JSON.stringify(meta)})`;
    }

    function formatPriceLabel(product, lang) {
        return lang === "ua" ? `${product.priceUah}\u20B4` : `${product.priceUsd}\u20AC`;
    }

    function updateProductDetailPricePreview(product) {
        const priceEl = document.getElementById("productPrice");
        const sizeSelect = document.getElementById("product-size");
        if (!priceEl || !sizeSelect || !product) return;

        const lang = getLang();
        const selectedSize = String(sizeSelect.value || "").toUpperCase();
        const surchargeUah =
            selectedSize === "3XL"
                ? (typeof tshirt3xlSurchargeUah === "number" ? tshirt3xlSurchargeUah : 200)
                : 0;

        if (lang === "ua") {
            priceEl.textContent = `${product.priceUah + surchargeUah}\u20B4`;
        } else {
            priceEl.textContent = `${product.priceUsd}\u20AC`;
        }
    }

    function buildSeoLine(product) {
        return `${product.title}. ${product.seoKeywords}. ${storeSeoKeywords}. Hardcore Division ${inferTypeName(product)} streetwear.`;
    }

    function getNewBadgeText() {
        return getLang() === "eng" ? "NEW" : "НОВЕ";
    }

    function getPreorderBadgeText() {
        return getLang() === "eng" ? "PREORDER" : "ПЕРЕДЗАМОВЛЕННЯ";
    }

    function buildProductSeoCopy(product) {
        const type = inferTypeName(product);
        const typeUa = type === "T-Shirt"
            ? "футболка"
            : (type === "Longsleeve" ? "лонгслів" : (type === "Sweatshirt" ? "світшот" : "худі"));
        const typeRu = type === "T-Shirt"
            ? "футболка"
            : (type === "Longsleeve" ? "лонгслив" : (type === "Sweatshirt" ? "свитшот" : "худи"));
        const descUa = (product.descUa || product.descEng || product.title).trim();
        const descEng = (product.descEng || product.descUa || product.title).trim();

        return {
            ua: `Купити ${typeUa} ${product.title} від Hardcore Division. ${descUa} Правий мерч Україна, мілітарі одяг, streetwear, український бренд одягу.`,
            ru: `Купить ${typeRu} ${product.title} от Hardcore Division. ${descUa} Правый мерч Украина, милитари одежда, streetwear бренд.`,
            eng: `Buy ${product.title} ${type} by Hardcore Division. ${descEng} Streetwear clothing from a Ukrainian brand.`
        };
    }

    function normalizeLookupText(value) {
        return String(value || "")
            .toLowerCase()
            .replace(/\s+/g, " ")
            .trim();
    }

    function normalizeLookupPath(value) {
        return String(value || "")
            .replace(/\\/g, "/")
            .replace(/^\.?\//, "")
            .split("?")[0]
            .toLowerCase()
            .trim();
    }

    function addLookupValue(map, key, product) {
        if (!key) return;
        if (!map.has(key)) {
            map.set(key, []);
        }
        map.get(key).push(product);
    }

    function createProductLookup(items) {
        const lookup = new Map();

        items.forEach((product) => {
            addLookupValue(lookup, `slug:${normalizeLookupText(product.slug)}`, product);
            addLookupValue(lookup, `title:${normalizeLookupText(product.title)}`, product);
            addLookupValue(lookup, `cart:${normalizeLookupText(product.cartName)}`, product);
            addLookupValue(lookup, `size:${normalizeLookupText(product.sizeId)}`, product);
            addLookupValue(lookup, `size:${normalizeLookupText(product.cartSizeId)}`, product);

            [product.image, product.imageAlt]
                .filter(Boolean)
                .forEach((imagePath) => {
                    const normalizedPath = normalizeLookupPath(imagePath);
                    const imageName = normalizedPath.split("/").pop();
                    addLookupValue(lookup, `image:${normalizedPath}`, product);
                    addLookupValue(lookup, `image:${imageName}`, product);
                });

            (Array.isArray(product.gallery) ? product.gallery : [])
                .filter(Boolean)
                .forEach((imagePath) => {
                    const normalizedPath = normalizeLookupPath(imagePath);
                    const imageName = normalizedPath.split("/").pop();
                    addLookupValue(lookup, `gallery:${normalizedPath}`, product);
                    addLookupValue(lookup, `gallery:${imageName}`, product);
                });
        });

        return lookup;
    }

    function takeFirstAvailableProduct(candidates, usedProductIds) {
        if (!Array.isArray(candidates) || !candidates.length) return null;
        return candidates.find((product) => !usedProductIds.has(product.id)) || null;
    }

    function resolveCardProduct(card, lookup, usedProductIds) {
        const titleEl = card.querySelector(".product-title");
        const primaryImg = card.querySelector(".product-img");
        const altImg = card.querySelector(".product-img-alt");
        const buyBtn = card.querySelector(".buy-btn");
        const sizeSelect = card.querySelector("select");
        const productSlug = card.getAttribute("data-product-slug");
        const buyBtnOnClick = String(buyBtn ? buyBtn.getAttribute("onclick") || "" : "");
        const cartNameMatch = buyBtnOnClick.match(/addToCart\('([^']+)'/);

        const lookupKeys = [
            `slug:${normalizeLookupText(productSlug)}`,
            `cart:${normalizeLookupText(cartNameMatch ? cartNameMatch[1] : "")}`,
            `size:${normalizeLookupText(sizeSelect ? sizeSelect.id : "")}`,
            `image:${normalizeLookupPath(primaryImg ? primaryImg.getAttribute("src") : "")}`,
            `image:${normalizeLookupPath(altImg ? altImg.getAttribute("src") : "")}`,
            `gallery:${normalizeLookupPath(primaryImg ? primaryImg.getAttribute("src") : "")}`,
            `gallery:${normalizeLookupPath(altImg ? altImg.getAttribute("src") : "")}`,
            `title:${normalizeLookupText(titleEl ? titleEl.textContent : "")}`
        ];

        for (const key of lookupKeys) {
            if (!key || key.endsWith(":")) continue;
            const product = takeFirstAvailableProduct(lookup.get(key), usedProductIds);
            if (product) {
                usedProductIds.add(product.id);
                return product;
            }
        }

        return null;
    }

    function enhanceCatalogCards() {
        const grid = document.querySelector(".shop-grid");
        const cards = Array.from(document.querySelectorAll(".shop-grid .product-card"));
        const lang = getLang();
        const lookup = createProductLookup(products);
        const usedProductIds = new Set();
        const cardItems = [];

        cards.forEach((card, index) => {
            const product = resolveCardProduct(card, lookup, usedProductIds);
            if (!product) return;
            cardItems.push({ card, product, index });

            const url = productUrl(product.slug);
            card.setAttribute("data-product-slug", product.slug);
            if (product.category) {
                card.setAttribute("data-category", product.category);
            }

            const imgContainer = card.querySelector(".product-img-container");
            if (imgContainer) {
                imgContainer.removeAttribute("onclick");
                let link = imgContainer.closest("a.product-link");
                if (!link) {
                    link = document.createElement("a");
                    link.className = "product-link";
                    imgContainer.parentNode.insertBefore(link, imgContainer);
                    link.appendChild(imgContainer);
                }
                link.href = url;
                link.setAttribute("aria-label", `Open ${product.title}`);
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
            if (title) {
                let link = title.querySelector("a");
                if (!link) {
                    title.textContent = "";
                    link = document.createElement("a");
                    link.className = "product-title-link";
                    title.appendChild(link);
                }
                link.href = url;
                link.textContent = getDisplayProductTitle(product, lang);
            }

            const buyBtn = card.querySelector(".buy-btn");
            const sizeSelect = card.querySelector("select");
            if (buyBtn && sizeSelect && sizeSelect.id) {
                buyBtn.setAttribute("onclick", buildCatalogAddToCartOnClick(product, sizeSelect.id));
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

            const isPreorder = Boolean(product && product.isPreorder);
            const existingPreorderBadge = imgContainer ? imgContainer.querySelector(".product-preorder-badge") : null;
            if (isPreorder && imgContainer && !existingPreorderBadge) {
                const preorderBadge = document.createElement("span");
                preorderBadge.className = "product-preorder-badge product-preorder-badge-corner";
                preorderBadge.setAttribute("data-ua", "ПЕРЕДЗАМОВЛЕННЯ");
                preorderBadge.setAttribute("data-eng", "PREORDER");
                preorderBadge.textContent = getPreorderBadgeText();
                imgContainer.appendChild(preorderBadge);
            }
            if (!isPreorder && existingPreorderBadge) {
                existingPreorderBadge.remove();
            }

            let hidden = card.querySelector(".product-seo-hidden");
            if (!hidden) {
                hidden = document.createElement("p");
                hidden.className = "seo-hidden product-seo-hidden";
                card.appendChild(hidden);
            }
            hidden.textContent = buildSeoLine(product);
        });

        if (grid && cardItems.length > 1) {
            const hashText = (value) => {
                const text = String(value || "");
                let hash = 0;
                for (let i = 0; i < text.length; i += 1) {
                    hash = ((hash * 31) + text.charCodeAt(i)) >>> 0;
                }
                return hash;
            };

            const byHash = (a, b) => {
                const aNew = Boolean(a.product && a.product.isNew);
                const bNew = Boolean(b.product && b.product.isNew);
                if (aNew !== bNew) return aNew ? -1 : 1;

                const aHash = hashText(a.product && a.product.slug);
                const bHash = hashText(b.product && b.product.slug);
                if (aHash !== bHash) return aHash - bHash;
                return a.index - b.index;
            };

            const caps = cardItems
                .filter((item) => inferTypeName(item.product) === "Cap")
                .sort(byHash);
            const longsleeves = cardItems
                .filter((item) => inferTypeName(item.product) === "Longsleeve")
                .sort(byHash);
            const sweatshirts = cardItems
                .filter((item) => inferTypeName(item.product) === "Sweatshirt")
                .sort(byHash);
            const tshirts = cardItems
                .filter((item) => inferTypeName(item.product) === "T-Shirt")
                .sort(byHash);
            const hoodies = cardItems
                .filter((item) => inferTypeName(item.product) === "Hoodie")
                .sort(byHash);

            const sorted = [...caps, ...longsleeves, ...sweatshirts];
            const initialTshirts = Math.min(2, tshirts.length);
            for (let i = 0; i < initialTshirts; i += 1) {
                sorted.push(tshirts.shift());
            }

            while (hoodies.length || tshirts.length) {
                if (hoodies.length) sorted.push(hoodies.shift());
                if (tshirts.length) sorted.push(tshirts.shift());
            }

            const swapByTitle = (firstTitle, secondTitle) => {
                const firstIndex = sorted.findIndex((item) => item.product && item.product.title === firstTitle);
                const secondIndex = sorted.findIndex((item) => item.product && item.product.title === secondTitle);
                if (firstIndex >= 0 && secondIndex >= 0 && firstIndex !== secondIndex) {
                    [sorted[firstIndex], sorted[secondIndex]] = [sorted[secondIndex], sorted[firstIndex]];
                }
            };

            const swapByCartName = (firstCartName, secondCartName) => {
                const firstIndex = sorted.findIndex((item) => item.product && item.product.cartName === firstCartName);
                const secondIndex = sorted.findIndex((item) => item.product && item.product.cartName === secondCartName);
                if (firstIndex >= 0 && secondIndex >= 0 && firstIndex !== secondIndex) {
                    [sorted[firstIndex], sorted[secondIndex]] = [sorted[secondIndex], sorted[firstIndex]];
                }
            };

            swapByTitle("Misanthrop Hoodie", "HARDCORE JUGEND");
            swapByCartName("Timur Mutsuraev T-Shirt", "HARDCORE CITADEL T-SHIRT");
            swapByCartName("HARDCORE LONGLSLEEVE", "HARDCORE CITADEL T-SHIRT");

            const preorderItems = sorted.filter((item) => item.product && item.product.isPreorder);
            const nonPreorderItems = sorted.filter((item) => !(item.product && item.product.isPreorder));
            const newItems = nonPreorderItems.filter((item) => item.product && item.product.isNew);
            const regularItems = nonPreorderItems.filter((item) => !(item.product && item.product.isNew));
            sorted.splice(0, sorted.length, ...preorderItems, ...newItems, ...regularItems);

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
        const catalogProducts = Array.from(document.querySelectorAll(".shop-grid .product-card"))
            .map((card) => {
                const slug = String(card.getAttribute("data-product-slug") || "").trim();
                if (!slug) return null;
                return products.find((product) => product && product.slug === slug) || null;
            })
            .filter(Boolean);

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
            "numberOfItems": catalogProducts.length,
            "itemListElement": catalogProducts.map((product, index) => ({
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
        const displayTitle = getDisplayProductTitle(product, lang);
        const imageGallery = Array.isArray(product.gallery) ? product.gallery.filter(Boolean) : [];
        const colorVariants = getProductColorVariants(product);
        const initialGallery = colorVariants.length ? getColorVariantGallery(colorVariants[0]) : imageGallery;
        const mainImg = initialGallery.length ? initialGallery[0] : product.image;
        const desc = lang === "ua" ? (product.descUa || product.descEng) : (product.descEng || product.descUa);
        const typeName = inferTypeName(product);
        const isCap = typeName === "Cap";
        const capLimitNote = isCap
            ? (lang === "ua" ? "Виробництво стартує після бронювання 30 кепок. Мінімальний запуск можливий від 15 броней. Передзамовлення доступне обмежений час. Час виробництва — 4 тижні." : "Production starts after 30 caps are reserved. Minimum launch is possible from 15 reservations. Pre-order is available for a limited time. Production time — 4 weeks.")
            : "";
        const productDescBlock = capLimitNote ? `${desc}<br>${capLimitNote}` : desc;
        const addLabel = lang === "ua" ? "\u0414\u041E\u0414\u0410\u0422\u0418 \u0412 \u041A\u041E\u0428\u0418\u041A" : "ADD TO CART";
        const backLabel = lang === "ua" ? "\u041D\u0430\u0437\u0430\u0434 \u0434\u043E \u043A\u0430\u0442\u0430\u043B\u043E\u0433\u0443" : "Back to catalog";
        const sizeGuideLabel = lang === "ua" ? "\u0420\u043E\u0437\u043C\u0456\u0440\u043D\u0430 \u0441\u0456\u0442\u043A\u0430" : "Size guide";
        const slugLabel = lang === "ua" ? "\u0410\u0440\u0442\u0438\u043A\u0443\u043B" : "SKU";
        const seoKeywords = buildSeoLine(product);
        const productSeoCopy = buildProductSeoCopy(product);
        const preorderBadge = product.isPreorder
            ? `<span class="product-preorder-badge product-preorder-badge-corner" data-ua="ПЕРЕДЗАМОВЛЕННЯ" data-eng="PREORDER">${getPreorderBadgeText()}</span>`
            : "";
        const newBadge = product.isNew
            ? `<span class="product-new-badge product-new-badge-corner product-new-badge-detail-corner" data-ua="НОВЕ" data-eng="NEW">${getNewBadgeText(product)}</span>`
            : "";

        const thumbs = buildProductThumbs(product, initialGallery);
        const sizeOptions = isCap
            ? `<option value="ONE SIZE">SIZE: ONE SIZE</option>`
            : `
                            <option value="S">SIZE: S</option>
                            <option value="M">SIZE: M</option>
                            <option value="L">SIZE: L</option>
                            <option value="XL">SIZE: XL</option>
                            <option value="2XL">SIZE: 2XL</option>
                            <option value="3XL">SIZE: 3XL</option>
                        `;
        const sizeGuideButton = isCap
            ? ""
            : `<button class="buy-btn size-guide-btn" id="sizeGuideBtn">${sizeGuideLabel}</button>`;
        const colorSelect = colorVariants.length
            ? `<select id="product-color">${buildColorOptions(colorVariants, lang)}</select>`
            : "";

        mount.innerHTML = `
            <style>
                .product-detail-back {
                    color: #888 !important;
                }
                @media (max-width: 768px) {
                    .product-detail-meta {
                        display: none !important;
                    }
                    .breadcrumbs {
                        display: none !important;
                    }
                    .product-detail-back {
                        display: inline-flex !important;
                        align-items: center;
                        gap: 8px;
                        background-color: transparent !important;
                        color: #ccc !important;
                        padding: 0 !important;
                        text-decoration: none !important; 
                        text-transform: uppercase; 
                        font-size: 0.85rem; 
                        letter-spacing: 1px; 
                        margin-bottom: 10px !important;
                    }
                }
                @media (min-width: 769px) {
                    .bc-mobile { display: none !important; }
                }
            </style>
            <div class="breadcrumbs">
                <span class="bc-desktop"><a href="/pages/index.html#catalog">Catalog</a> / <span>${displayTitle}</span></span>
                <a href="/pages/index.html#catalog" class="bc-mobile">&#8592; ${backLabel}</a>
            </div>
            <article class="product-detail-card">
                <div class="product-detail-media">
                    ${newBadge}
                    ${preorderBadge}
                    <img src="${mainImg}" id="productMainImage" class="product-detail-main-img" alt="${product.title} ${typeName}" loading="eager" decoding="async">
                    <div class="product-detail-thumbs">${thumbs}</div>
                </div>
                <div class="product-detail-info">
                    <a href="/pages/index.html#catalog" class="product-detail-back">${backLabel}</a>
                    <h1 class="product-detail-title">${displayTitle}</h1>
                    <p class="product-detail-meta"><strong>${slugLabel}:</strong> ${product.slug}</p>
                    <p class="product-detail-desc">${productDescBlock}</p>
                    <div class="price" id="productPrice" data-uah="${product.priceUah}\u20B4" data-usd="${product.priceUsd}\u20AC">${formatPriceLabel(product, lang)}</div>
                    <div class="product-detail-actions">
                        <select id="product-size">
                            ${sizeOptions}
                        </select>
                        ${colorSelect}
                        <button class="buy-btn" id="addProductBtn">${addLabel}</button>
                        ${sizeGuideButton}
                    </div>
                    <div class="product-detail-filler-art" aria-hidden="true">
                        <img src="images/photo_2026-03-13_20-42-54.png" alt="">
                    </div>
                </div>
                <section class="seo-hidden" aria-label="Product search keywords">
                    <h2>${displayTitle} Hardcore Division</h2>
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
                const selectedCartName = currentColorVariant
                    ? buildColorVariantCartName(product, currentColorVariant)
                    : product.cartName;
                addToCart(selectedCartName, product.priceUah, product.priceUsd, "product-size", {
                    image: currentGallery[0] || product.image,
                    productSlug: product.slug,
                    color: currentColorVariant && currentColorVariant.value ? String(currentColorVariant.value) : ""
                });
            });
        }

        const sizeSelect = document.getElementById("product-size");
        if (sizeSelect) {
            sizeSelect.addEventListener("change", function () {
                updateProductDetailPricePreview(product);
            });
        }

        updateProductDetailPricePreview(product);

        const mainImageNode = document.getElementById("productMainImage");
        const thumbsWrap = mount.querySelector(".product-detail-thumbs");
        let currentGallery = initialGallery.length ? initialGallery.slice() : imageGallery.slice();
        let currentColorVariant = colorVariants.length ? colorVariants[0] : null;

        const bindThumbClicks = () => {
            const thumbNodes = mount.querySelectorAll(".product-detail-thumbs img");
            thumbNodes.forEach((thumb) => {
                thumb.addEventListener("click", function () {
                    if (!mainImageNode) return;
                    mainImageNode.src = thumb.getAttribute("src");
                });
            });
        };

        const renderGallerySet = (gallery) => {
            currentGallery = Array.isArray(gallery) && gallery.length ? gallery.slice() : imageGallery.slice();
            if (mainImageNode) {
                mainImageNode.src = currentGallery[0] || product.image;
                mainImageNode.alt = `${product.title} ${typeName}`;
            }
            if (thumbsWrap) {
                thumbsWrap.innerHTML = buildProductThumbs(product, currentGallery);
                bindThumbClicks();
            }
        };

        if (mainImageNode) {
            mainImageNode.addEventListener("click", function () {
                if (typeof openGallery === "function") {
                    openGallery(currentGallery.length ? currentGallery : imageGallery);
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

        const colorSelectNode = document.getElementById("product-color");
        if (colorSelectNode) {
            colorSelectNode.addEventListener("change", function () {
                const selectedVariant = colorVariants.find((variant, index) => {
                    const variantValue = variant && variant.value ? String(variant.value) : String(index);
                    return variantValue === String(colorSelectNode.value || "");
                });
                currentColorVariant = selectedVariant || currentColorVariant;
                renderGallerySet(getColorVariantGallery(selectedVariant));
            });
        }

        bindThumbClicks();
    }

    function setupProductSeo(product) {
        const displayTitle = getDisplayProductTitle(product, getLang());
        const title = `${displayTitle} | Hardcore Division`;
        const description = (product.descEng || product.descUa || product.title).slice(0, 180);
        const image = absUrl((product.gallery && product.gallery[0]) || product.image);
        const pageLink = productUrl(product.slug);

        document.title = title;
        setCanonical(pageLink);
        setMetaName("description", description);
        setMetaName("keywords", `${product.seoKeywords}, buy ${displayTitle}, hardcore division ${inferTypeName(product).toLowerCase()}`);
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
            "name": displayTitle,
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
                    <a class="product-detail-back" href="/pages/index.html#catalog">Back to catalog</a>
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
        if (page === "catalog") {
            enhanceCatalogCards();
            setupCatalogSeo();
            return;
        }
        if (page === "product" && activeProduct) {
            renderProduct(activeProduct);
            setupProductSeo(activeProduct);
        }
    });

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
