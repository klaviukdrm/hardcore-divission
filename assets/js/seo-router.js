(function () {
    const initialStaticProducts = Array.isArray(window.PRODUCTS_DATA) ? window.PRODUCTS_DATA.map((p) => ({ ...p })) : [];
    const staticProductsMap = new Map();
    initialStaticProducts.forEach((p) => {
        if (p && p.slug) staticProductsMap.set(p.slug, p);
    });
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
            return title.replace(/\[(\d+)\s+КОЛОРА\]/gi, "[$1 COLORS]");
        }
        return title.replace(/\[(\d+)\s+COLORS\]/gi, "[$1 КОЛОРА]");
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
        if (category.includes("патч") || /patch/i.test(cartName)) {
            return "Patch";
        }
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

    function isContactOnlyProduct(product) {
        if (!product) return false;
        if (product.contactUrl) return true;
        const category = String(product.category || "").toLowerCase();
        const slug = String(product.slug || "").toLowerCase();
        const cartName = String(product.cartName || "").toLowerCase();
        return category.includes("патч") || slug.includes("patch") || cartName.includes("patch") || cartName.includes("патч");
    }

    function getProductContactUrl(product) {
        return (product && product.contactUrl) ? product.contactUrl : "https://t.me/hardcore1499";
    }

    function hasProductSizeGuide(product) {
        if (!product) return false;
        if (product.noSize) return false;
        if (isContactOnlyProduct(product)) return false;
        const category = String(product.category || "").toLowerCase();
        const slug = String(product.slug || "").toLowerCase();
        const cartName = String(product.cartName || "").toLowerCase();
        if (category.includes("патч") || slug.includes("patch") || cartName.includes("patch")) return false;
        if (category.includes("кепк") || slug.includes("cap") || cartName.includes("cap")) return false;
        return true;
    }

    const turboskinProductSlugs = new Set([
        "turbohardcore-turbohardcore-hoodie",
        "turbohardcore-red-turbohardcore-t-shirt-red",
        "turbonasillia-turbonasillia-hoodie",
        "turbonasillia-turbonasillia-t-shirt",
        "trbskn-gen1-trbskn-gen1-hoodie",
        "trbskn-gen1-trbskn-gen1-t-shirt",
        "nlyl-nlyl-hoodie",
        "nlyl-nlyl-t-shirt",
        "protect-your-karma-protect-your-karma-hoodie",
        "protect-your-karma-protect-your-karma-t-shirt",
        "trbskn-gen2-trbskn-gen2-hoodie",
        "trbskn-gen2-trbskn-gen2-t-shirt",
        "turb8sk1n-httb-gen3-t-shirt",
        "turb8sk1n-httb-gen3-hoodie"
    ]);

    const designerProductSlugs = new Set([
        "handofdust-support-gen1-t-shirt",
        "handofdust-support-gen2-t-shirt"
    ]);

    function isTurboskinProduct(product) {
        if (product && product.brand === 'turboskin') return true;
        const slug = String(product && product.slug ? product.slug : "").trim().toLowerCase();
        return turboskinProductSlugs.has(slug);
    }

    function isDesignerProduct(product) {
        if (product && (product.brand === 'designer' || product.brand === 'handofdust')) return true;
        const slug = String(product && product.slug ? product.slug : "").trim().toLowerCase();
        return designerProductSlugs.has(slug);
    }

    function getTurboskinProductNote(lang) {
        return lang === "eng"
            ? "This product belongs to Turboskin and is not affiliated with the Hardcore Division brand."
            : "Цей товар належить до Turboskin і не має відношення до бренду Hardcore Division.";
    }

    function getDesignerProductNote(lang) {
        return lang === "eng"
            ? "This product belongs to Designer (handofdust) and is not affiliated with the Hardcore Division brand."
            : "Цей товар належить дизайнеру (handofdust) і не має відношення до бренду Hardcore Division.";
    }

    function shouldHideProductPrice(product) {
        if (!product) return false;
        if (Boolean(product.transparentPrice)) return true;
        const category = String(product.category || "").toLowerCase();
        const slug = String(product.slug || "").toLowerCase();
        const cartName = String(product.cartName || "").toLowerCase();
        const priceUah = Number(product.priceUah || product.price_uah || 0);
        return category.includes("кепк") || slug.includes("cap") || cartName.includes("cap") || priceUah <= 0;
    }

    function getPriceClass(product) {
        return shouldHideProductPrice(product) ? "price price-transparent" : "price";
    }

    function getContactButtonLabel(lang) {
        return lang === "ua" ? "Написати" : "Write";
    }

    function getUnavailableButtonLabel(lang) {
        return lang === "ua" ? "Немає в наявності" : "OUT OF STOCK";
    }

    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function escapeAttr(value) {
        return escapeHtml(value);
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
        const hasColorMarker = /\[(\d+)\s+(КОЛОРА|COLORS)\]/i.test(String(product && product.title ? product.title : ""));
        if (!hasColorMarker || !Array.isArray(product && product.colorVariants)) return [];
        return product.colorVariants.filter((variant) => Array.isArray(variant && variant.gallery) && variant.gallery.length);
    }

    function getColorVariantGallery(variant) {
        return Array.isArray(variant && variant.gallery) ? variant.gallery.filter(Boolean) : [];
    }

    function buildProductThumbs(product, gallery, activeIndex = 0) {
        return gallery.map((img, idx) =>
            `<img src="${img}" alt="${product.title} view ${idx + 1}" data-idx="${idx}" class="${idx === activeIndex ? "is-active" : ""}" loading="lazy" decoding="async">`
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
        const strippedBase = baseCartName.replace(/\s+(black|white|red|green)$/i, "").trim();
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

    function getCatalogOrder(product) {
        const order = Number(product && product.catalogOrder);
        return Number.isFinite(order) ? order : null;
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
            : (type === "Longsleeve" ? "лонгслів" : (type === "Sweatshirt" ? "світшот" : (type === "Cap" ? "кепка" : "худі")));
        const typeRu = type === "T-Shirt"
            ? "футболка"
            : (type === "Longsleeve" ? "лонгслив" : (type === "Sweatshirt" ? "свитшот" : (type === "Cap" ? "кепка" : "худи")));
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

    function buildDefaultSizeSelect(sizeId, product) {
        if (!sizeId && !(product && product.noSize)) return "";
        if (product && product.noSize) {
            if (product.soldOut || isContactOnlyProduct(product)) return "";
            return `
                <select id="${escapeAttr(sizeId || `size-${product.id || "one-size"}`)}">
                    <option value="ONE SIZE">SIZE: ONE SIZE</option>
                </select>`;
        }
        const sizes = Array.isArray(product && product.sizes) && product.sizes.length
            ? product.sizes.map((size) => String(size || "").trim()).filter(Boolean)
            : ["S", "M", "L", "XL", "2XL", "3XL"];
        return `
                <select id="${escapeAttr(sizeId)}">
                    ${sizes.map((size) => `<option value="${escapeAttr(size)}">SIZE: ${escapeHtml(size)}</option>`).join("")}
                </select>`;
    }

    function buildCatalogCardButton(product, lang) {
        if (Boolean(product && product.soldOut)) {
            const label = getUnavailableButtonLabel(lang);
            return `<button class="buy-btn" data-ua="Немає в наявності" data-eng="OUT OF STOCK" disabled aria-disabled="true">${escapeHtml(label)}</button>`;
        }
        if (isContactOnlyProduct(product)) {
            const label = getContactButtonLabel(lang);
            const contactUrl = getProductContactUrl(product);
            return `<button class="buy-btn" data-ua="Написати" data-eng="Write" onclick="window.location.href='${escapeAttr(contactUrl)}'">${escapeHtml(label)}</button>`;
        }

        const sizeId = product.sizeId || product.cartSizeId || (product.noSize || isContactOnlyProduct(product) ? "" : `size-db-${product.id || product.slug}`);
        if (!sizeId) return "";
        return `<button class="buy-btn" data-ua="В КОШИК" data-eng="ADD TO CART" onclick="${escapeAttr(buildCatalogAddToCartOnClick(product, sizeId))}">В КОШИК</button>`;
    }

    function buildCatalogCard(product, lang) {
        const gallery = Array.isArray(product.gallery) ? product.gallery.filter(Boolean) : [];
        const primaryImage = product.image || gallery[0] || "";
        const altImage = product.imageAlt || gallery[1] || primaryImage;
        const displayTitle = getDisplayProductTitle(product, lang);
        const descUa = product.descUa || product.descEng || "";
        const descEng = product.descEng || product.descUa || "";
        const sizeId = product.noSize || isContactOnlyProduct(product) ? "" : (product.sizeId || product.cartSizeId || `size-db-${product.id || product.slug}`);

        return `
    <div class="product-card" data-category="${escapeAttr(product.category || "")}" data-product-slug="${escapeAttr(product.slug || "")}">
        <a class="product-link" href="${escapeAttr(productUrl(product.slug || ""))}" aria-label="Open ${escapeAttr(product.title || "")}">
            <div class="product-img-container">
                <img src="${escapeAttr(primaryImage)}" class="product-img" loading="lazy" decoding="async" alt="${escapeAttr(product.title || "Hardcore Division product")}">
                <img src="${escapeAttr(altImage)}" class="product-img-alt" loading="lazy" decoding="async" alt="${escapeAttr(product.title || "Hardcore Division product")} alternate view">
            </div>
        </a>
        <div class="product-info">
            <div><h3 class="product-title">${escapeHtml(displayTitle)}</h3><p class="product-desc" data-ua="${escapeAttr(descUa)}" data-eng="${escapeAttr(descEng)}">${escapeHtml(descUa)}</p></div>
            <div>
                <div class="${getPriceClass(product)}" data-uah="${Number(product.priceUah) || 0}₴" data-usd="${Number(product.priceUsd) || 0}€"></div>
                ${buildDefaultSizeSelect(sizeId, product)}
                ${buildCatalogCardButton(product, lang)}
            </div>
        </div>
    </div>`;
    }

    function createDynamicCatalogCards(grid, lang) {
        if (!grid) return;
        products
            .filter((product) => product && product.renderInCatalog)
            .forEach((product) => {
                const slug = String(product.slug || "");
                const alreadyRendered = Array.from(grid.querySelectorAll(".product-card"))
                    .some((card) => String(card.getAttribute("data-product-slug") || "") === slug);
                if (!slug || alreadyRendered) return;
                grid.insertAdjacentHTML("beforeend", buildCatalogCard(product, lang));
            });
    }

    function enhanceCatalogCards() {
        const grid = document.querySelector(".shop-grid");
        createDynamicCatalogCards(grid, getLang());
        const cards = Array.from(document.querySelectorAll(".shop-grid .product-card"));
        const lang = getLang();
        const lookup = createProductLookup(products);
        const usedProductIds = new Set();
        const cardItems = [];

        cards.forEach((card, index) => {
            const product = resolveCardProduct(card, lookup, usedProductIds);
            if (!product) {
                if (window.__productsLoadedFromRemote) {
                    card.remove();
                }
                return;
            }
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
                    link.setAttribute("href", url);
                    link.setAttribute("aria-label", `Open ${product.title}`);
                    imgContainer.parentNode.insertBefore(link, imgContainer);
                    link.appendChild(imgContainer);
                } else {
                    link.setAttribute("href", url);
                }
            }

            const titleEl = card.querySelector(".product-title");
            if (titleEl) {
                titleEl.textContent = getDisplayProductTitle(product, lang);
            }

            const sizeSelect = card.querySelector("select");
            if (sizeSelect && (product.noSize || isContactOnlyProduct(product))) {
                if (isContactOnlyProduct(product)) {
                    sizeSelect.remove();
                } else {
                    sizeSelect.innerHTML = `<option value="ONE SIZE">SIZE: ONE SIZE</option>`;
                }
            } else if (!sizeSelect && !product.noSize && !isContactOnlyProduct(product)) {
                const targetSizeId = product.sizeId || product.cartSizeId || `size-db-${product.id || product.slug}`;
                const selectHtml = buildDefaultSizeSelect(targetSizeId, product);
                const infoContainer = card.querySelector(".product-info > div:last-child");
                if (infoContainer && selectHtml) {
                    infoContainer.insertAdjacentHTML("afterbegin", selectHtml);
                }
            }

            const buyBtn = card.querySelector(".buy-btn");
            if (buyBtn && Boolean(product.soldOut)) {
                const label = getUnavailableButtonLabel(lang);
                buyBtn.setAttribute("disabled", "true");
                buyBtn.setAttribute("aria-disabled", "true");
                buyBtn.removeAttribute("onclick");
                buyBtn.setAttribute("data-ua", "Немає в наявності");
                buyBtn.setAttribute("data-eng", "OUT OF STOCK");
                buyBtn.textContent = label;
            } else if (buyBtn && isContactOnlyProduct(product)) {
                const contactUrl = getProductContactUrl(product);
                buyBtn.setAttribute("onclick", `window.location.href='${escapeAttr(contactUrl)}'`);
                buyBtn.setAttribute("data-ua", "Написати");
                buyBtn.setAttribute("data-eng", "Write");
                buyBtn.textContent = getContactButtonLabel(lang);
            } else if (buyBtn && sizeSelect && sizeSelect.id) {
                buyBtn.setAttribute("onclick", buildCatalogAddToCartOnClick(product, sizeSelect.id));
            }

            const price = card.querySelector(".price");
            if (price) {
                price.classList.toggle("price-transparent", shouldHideProductPrice(product));
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

            const isPreorder = Boolean(product && (product.isPreorder || product.visualPreorder));
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
            const compareCatalogItems = (a, b) => {
                const aNew = Boolean(a.product && a.product.isNew);
                const bNew = Boolean(b.product && b.product.isNew);
                if (aNew !== bNew) return aNew ? -1 : 1;

                const aOrder = getCatalogOrder(a.product);
                const bOrder = getCatalogOrder(b.product);
                if (aOrder !== null || bOrder !== null) {
                    if (aOrder === null) return 1;
                    if (bOrder === null) return -1;
                    if (aOrder !== bOrder) return aOrder - bOrder;
                }

                return a.index - b.index;
            };

            const sorted = [...cardItems].sort(compareCatalogItems);

            const changedOrder = sorted.some((item, idx) => item !== cardItems[idx]);
            if (changedOrder) {
                sorted.forEach((item) => {
                    grid.appendChild(item.card);
                });
            }
        }

        if (typeof window.applyCatalogFilters === "function") {
            window.applyCatalogFilters(true);
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
        const isCap = typeName === "Cap" || String(product.category || "").toLowerCase().includes("кепк") || String(product.slug || "").toLowerCase().includes("cap");
        const isPatch = isContactOnlyProduct(product);
        const soldOut = Boolean(product && product.soldOut);
        const pageNote = lang === "ua" ? (product.pageNoteUa || "") : (product.pageNoteEng || "");
        const capLimitNote = isCap && !soldOut
            ? (lang === "ua" ? "Виробництво стартує після бронювання 30 кепок. Мінімальний запуск можливий від 15 броней. Передзамовлення доступне обмежений час. Час виробництва — 4 тижні." : "Production starts after 30 caps are reserved. Minimum launch is possible from 15 reservations. Pre-order is available for a limited time. Production time — 4 weeks.")
            : "";
        const productDescBlock = capLimitNote ? `${desc}<br>${capLimitNote}` : desc;
        const turboskinNote = isTurboskinProduct(product)
            ? `<p class="product-detail-note product-turboskin-note">${escapeHtml(getTurboskinProductNote(lang))}</p>`
            : (isDesignerProduct(product)
                ? `<p class="product-detail-note product-designer-note">${escapeHtml(getDesignerProductNote(lang))}</p>`
                : "");
        const contactOnly = isContactOnlyProduct(product) && !soldOut;
        const hasSize = hasProductSizeGuide(product);
        const contactUrl = getProductContactUrl(product);
        const addLabel = soldOut
            ? getUnavailableButtonLabel(lang)
            : (contactOnly ? getContactButtonLabel(lang) : (lang === "ua" ? "ДОДАТИ В КОШИК" : "ADD TO CART"));
        const backLabel = lang === "ua" ? "Назад до каталогу" : "Back to catalog";
        const sizeGuideLabel = lang === "ua" ? "Розмірна сітка" : "Size guide";
        const slugLabel = lang === "ua" ? "Артикул" : "SKU";
        const seoKeywords = buildSeoLine(product);
        const productSeoCopy = buildProductSeoCopy(product);
        const preorderBadge = product.isPreorder || product.visualPreorder
            ? `<span class="product-preorder-badge product-preorder-badge-corner" data-ua="ПЕРЕДЗАМОВЛЕННЯ" data-eng="PREORDER">${getPreorderBadgeText()}</span>`
            : "";
        const newBadge = product.isNew
            ? `<span class="product-new-badge product-new-badge-corner product-new-badge-detail-corner" data-ua="НОВЕ" data-eng="NEW">${getNewBadgeText(product)}</span>`
            : "";

        const thumbs = buildProductThumbs(product, initialGallery);
        const sizeOptions = isCap
            ? `<option value="ONE SIZE">SIZE: ONE SIZE</option>`
            : (Array.isArray(product && product.sizes) && product.sizes.length
                ? product.sizes.map((size) => String(size || "").trim()).filter(Boolean)
                : ["S", "M", "L", "XL", "2XL", "3XL"]
            ).map((size) => `<option value="${escapeAttr(size)}">SIZE: ${escapeHtml(size)}</option>`).join("");
        const sizeSelectMarkup = (!hasSize || isPatch)
            ? ""
            : (isCap
                ? `<select id="product-size">
                            <option value="ONE SIZE">SIZE: ONE SIZE</option>
                        </select>`
                : `<select id="product-size">
                            ${sizeOptions}
                        </select>`);
        const sizeGuideButton = !hasSize
            ? ""
            : `<button class="buy-btn size-guide-btn" id="sizeGuideBtn">${sizeGuideLabel}</button>`;
        const actionButton = soldOut
            ? `<button class="buy-btn" id="contactProductBtn" data-ua="Немає в наявності" data-eng="OUT OF STOCK" disabled aria-disabled="true">${addLabel}</button>`
            : (contactOnly
                ? `<button class="buy-btn" id="contactProductBtn" onclick="window.location.href='${escapeAttr(contactUrl)}'">${addLabel}</button>`
                : `<button class="buy-btn" id="addProductBtn">${addLabel}</button>`);
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
            <article class="product-detail-card${colorVariants.length ? " product-detail-card-has-colors" : ""}">
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
                    ${turboskinNote}
                    ${pageNote ? `<p class="product-detail-note">${escapeHtml(pageNote)}</p>` : ""}
                    <div class="${getPriceClass(product)}" id="productPrice" data-uah="${product.priceUah}\u20B4" data-usd="${product.priceUsd}\u20AC">${formatPriceLabel(product, lang)}</div>
                    <div class="product-detail-actions">
                        ${sizeSelectMarkup}
                        ${colorSelect}
                        ${actionButton}
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
        if (btn && !contactOnly) {
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
        let currentActiveThumbIndex = 0;

        const setActiveThumb = (activeIndex) => {
            currentActiveThumbIndex = Number.isInteger(activeIndex) && activeIndex >= 0 ? activeIndex : 0;
            const thumbNodes = mount.querySelectorAll(".product-detail-thumbs img");
            thumbNodes.forEach((thumb) => {
                const thumbIndex = Number(thumb.getAttribute("data-idx"));
                thumb.classList.toggle("is-active", thumbIndex === currentActiveThumbIndex);
            });
        };

        const bindThumbClicks = () => {
            const thumbNodes = mount.querySelectorAll(".product-detail-thumbs img");
            thumbNodes.forEach((thumb) => {
                thumb.addEventListener("click", function () {
                    const thumbIndex = Number(this.getAttribute("data-idx"));
                    if (!mainImageNode) return;
                    mainImageNode.src = this.getAttribute("src");
                    setActiveThumb(Number.isFinite(thumbIndex) ? thumbIndex : 0);
                });
            });
        };

        const renderGallerySet = (gallery, activeIndex = 0) => {
            currentGallery = Array.isArray(gallery) && gallery.length ? gallery.slice() : imageGallery.slice();
            currentActiveThumbIndex = Number.isInteger(activeIndex) && activeIndex >= 0 ? activeIndex : 0;
            if (mainImageNode) {
                mainImageNode.src = currentGallery[currentActiveThumbIndex] || currentGallery[0] || product.image;
                mainImageNode.alt = `${product.title} ${typeName}`;
            }
            if (thumbsWrap) {
                thumbsWrap.innerHTML = buildProductThumbs(product, currentGallery, currentActiveThumbIndex);
                bindThumbClicks();
                setActiveThumb(currentActiveThumbIndex);
            }
        };

        if (mainImageNode) {
            mainImageNode.addEventListener("click", function () {
                if (typeof openGallery === "function") {
                    openGallery(currentGallery.length ? currentGallery : imageGallery, currentActiveThumbIndex);
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
                renderGallerySet(getColorVariantGallery(selectedVariant), 0);
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
                "availability": product.soldOut ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
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

    async function loadRemoteProducts() {
        try {
            const response = await fetch("/api/products");
            if (!response.ok) return;
            const data = await response.json();
            const remoteProducts = Array.isArray(data.products) ? data.products : [];
            if (!remoteProducts.length) return;

            // Sort remote products by catalogOrder
            remoteProducts.sort((a, b) => (Number(a.catalogOrder || a.catalog_order) || 500) - (Number(b.catalogOrder || b.catalog_order) || 500));

            window.__productsLoadedFromRemote = true;

            // 1. Synchronize main products array with Supabase DB (preserving static notes and special properties)
            const mergedProducts = remoteProducts.map((rp) => {
                if (rp && rp.slug && staticProductsMap.has(rp.slug)) {
                    const staticItem = staticProductsMap.get(rp.slug);
                    return Object.assign({}, staticItem, rp);
                }
                return rp;
            });

            products.length = 0;
            mergedProducts.forEach((mp) => products.push(mp));
            if (Array.isArray(window.PRODUCTS_DATA)) {
                window.PRODUCTS_DATA.length = 0;
                mergedProducts.forEach((mp) => window.PRODUCTS_DATA.push(mp));
            }

            // 2. Re-render / enhance catalog (orphaned/deleted static cards will be automatically removed from DOM)
            if (page === "catalog") {
                enhanceCatalogCards();
                setupCatalogSeo();
            } else if (page === "product") {
                const currentSlug = new URLSearchParams(window.location.search).get("product");
                const found = products.find((p) => p.slug === currentSlug);
                if (found) {
                    activeProduct = found;
                    renderProduct(found);
                    setupProductSeo(found);
                } else if (currentSlug && !activeSlugs.has(currentSlug)) {
                    const titleEl = document.getElementById("productTitle");
                    if (titleEl) titleEl.textContent = "Товар не знайдено або знято з продажу";
                    const buyBtn = document.getElementById("productBuyBtn");
                    if (buyBtn) buyBtn.style.display = "none";
                }
            }
        } catch (e) {
            // Silently fall back to static products
        }
    }

    function init() {
        if (page === "catalog") {
            initCatalogPage();
            loadRemoteProducts();
            return;
        }
        if (page === "product") {
            initProductPage();
            loadRemoteProducts();
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
