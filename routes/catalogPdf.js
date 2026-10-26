const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const sharp = require('sharp');
const db = require('../database');

/**
 * Helper to get site settings dictionary
 */
function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const s = {};
  rows.forEach(r => { s[r.key] = r.value; });
  return {
    company_name: s.company_name || 'Ceramica Ethiopia',
    company_tagline: s.company_tagline || 'Premium Ceramic & Porcelain Solutions',
    company_description: s.company_description || "Ethiopia's premier supplier of ceramic tiles, porcelain, sanitary ware, faucets, and bathroom appliances.",
    company_address: s.company_address || 'Bole Road, Addis Ababa, Ethiopia',
    company_phone: s.company_phone || '+251 11 123 4567',
    company_email: s.company_email || 'info@ceramicaethiopia.com',
    company_whatsapp: s.company_whatsapp || '+251 91 123 4567',
    working_hours: s.working_hours || 'Mon – Sat: 8:00 AM – 6:00 PM',
  };
}

/**
 * Format currency
 */
function fmtPrice(val, cur = 'ETB', unit = 'm²') {
  const n = parseFloat(val) || 0;
  return `${new Intl.NumberFormat('en-US').format(n)} ${cur} / ${unit}`;
}

/**
 * GET /api/catalog/download-pdf
 * Generates an architectural PDF catalog on-the-fly from the latest database records
 */
router.get('/download-pdf', async (req, res) => {
  try {
    const settings = getSettings();

    // Query all published products with category details
    const products = db.prepare(`
      SELECT p.*, c.name as category_name, c.slug as category_slug, c.display_order as cat_order
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_published = 1
      ORDER BY COALESCE(c.display_order, 999) ASC, p.name ASC
    `).all();

    // Query categories with products
    const categories = db.prepare(`
      SELECT c.*, COUNT(p.id) as product_count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id AND p.is_published = 1
      GROUP BY c.id
      ORDER BY c.display_order ASC
    `).all().filter(c => c.product_count > 0);

    // Setup PDFKit document
    const doc = new PDFDocument({
      size: 'A4',
      margin: 36,
      bufferPages: true,
      info: {
        Title: `${settings.company_name} — Full Product Catalog`,
        Author: settings.company_name,
        Subject: 'Architectural Product Catalog & Specification Guide',
        Keywords: 'ceramic, porcelain, tiles, sanitary ware, faucets, ethiopia, atlas concorde'
      }
    });

    const filename = `Ceramica-Ethiopia-Catalog-${new Date().toISOString().split('T')[0]}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    doc.pipe(res);

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const margin = 36;
    const contentWidth = pageWidth - (margin * 2);

    // ============================================================
    // COVER PAGE
    // ============================================================
    // Background tint
    doc.rect(0, 0, pageWidth, pageHeight).fill('#FBFBFA');

    // Accent top banner
    doc.rect(0, 0, pageWidth, 12).fill('#1A1A1A');
    doc.rect(0, 12, pageWidth, 4).fill('#8B7355');

    // Geometric border
    doc.lineWidth(1)
       .strokeColor('#E0DCD5')
       .rect(margin, margin + 8, contentWidth, pageHeight - (margin * 2) - 16)
       .stroke();

    // Inner subtle border
    doc.lineWidth(0.5)
       .strokeColor('#ECE9E3')
       .rect(margin + 6, margin + 14, contentWidth - 12, pageHeight - (margin * 2) - 28)
       .stroke();

    // Header eyebrow
    let y = 90;
    doc.fontSize(8.5)
       .font('Helvetica')
       .fillColor('#8B7355')
       .text('SURFACE DESIGN & ARCHITECTURAL SOLUTIONS', margin + 30, y, {
         characterSpacing: 2,
         width: contentWidth - 60,
         align: 'center'
       });

    // Company Title
    y += 24;
    doc.fontSize(28)
       .font('Helvetica-Bold')
       .fillColor('#111111')
       .text(settings.company_name.toUpperCase(), margin + 30, y, {
         characterSpacing: 3,
         width: contentWidth - 60,
         align: 'center'
       });

    y += 36;
    doc.fontSize(10)
       .font('Helvetica')
       .fillColor('#666666')
       .text(settings.company_tagline, margin + 30, y, {
         characterSpacing: 1,
         width: contentWidth - 60,
         align: 'center'
       });

    // Decorative line with center diamond
    y += 30;
    const midX = pageWidth / 2;
    doc.lineWidth(0.8).strokeColor('#8B7355').moveTo(midX - 90, y).lineTo(midX - 15, y).stroke();
    doc.lineWidth(0.8).strokeColor('#8B7355').moveTo(midX + 15, y).lineTo(midX + 90, y).stroke();
    doc.fontSize(7).fillColor('#8B7355').text('◆', midX - 3.5, y - 4);

    // Catalog Main Title
    y += 36;
    doc.fontSize(18)
       .font('Helvetica-Bold')
       .fillColor('#1A1A1A')
       .text('OFFICIAL PRODUCT CATALOG & SPECIFICATION GUIDE', margin + 30, y, {
         width: contentWidth - 60,
         align: 'center',
         lineGap: 4
       });

    y += 32;
    doc.fontSize(9.5)
       .font('Helvetica')
       .fillColor('#555555')
       .text('Comprehensive Specification & Price Index for Architects, Contractors, Government Agencies & Procurement Officers', margin + 40, y, {
         width: contentWidth - 80,
         align: 'center',
         lineGap: 3
       });

    // Overview Stats Card
    y += 45;
    const cardW = contentWidth - 60;
    const cardX = margin + 30;
    const cardH = 80;

    doc.rect(cardX, y, cardW, cardH).fillAndStroke('#FFFFFF', '#E2DED7');

    const colW = cardW / 3;
    const statCols = [
      { num: `${products.length}`, label: 'Published Items', sub: 'In-Stock Range' },
      { num: `${categories.length}`, label: 'Collections', sub: 'Italian Aesthetic' },
      { num: 'ETB', label: 'Official Pricing', sub: 'VAT & Specs Included' }
    ];

    statCols.forEach((col, i) => {
      const cx = cardX + (i * colW);
      if (i > 0) {
        doc.lineWidth(0.5).strokeColor('#EAE7E1').moveTo(cx, y + 12).lineTo(cx, y + cardH - 12).stroke();
      }
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#111111').text(col.num, cx, y + 16, { width: colW, align: 'center' });
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#8B7355').text(col.label, cx, y + 36, { width: colW, align: 'center' });
      doc.fontSize(7.5).font('Helvetica').fillColor('#888888').text(col.sub, cx, y + 50, { width: colW, align: 'center' });
    });

    // Date & Generation Notice
    y += cardH + 35;
    const genDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    doc.fontSize(8.5)
       .font('Helvetica-Bold')
       .fillColor('#111111')
       .text(`EDITION: ${genDate.toUpperCase()}`, margin + 30, y, { width: contentWidth - 60, align: 'center' });

    y += 16;
    doc.fontSize(8)
       .font('Helvetica')
       .fillColor('#777777')
       .text('Generated in real-time from active inventory database · Ceramica Ethiopia Showroom, Addis Ababa', margin + 30, y, { width: contentWidth - 60, align: 'center' });

    // Bottom Contact Box
    const contactBoxH = 80;
    const contactBoxY = pageHeight - margin - contactBoxH - 24;

    doc.rect(margin + 20, contactBoxY, contentWidth - 40, contactBoxH).fillAndStroke('#191919', '#191919');

    doc.fontSize(8.5)
       .font('Helvetica-Bold')
       .fillColor('#C4A882')
       .text('HEADQUARTERS & SHOWROOM INQUIRIES', margin + 20, contactBoxY + 12, {
         width: contentWidth - 40,
         align: 'center',
         characterSpacing: 1
       });

    doc.fontSize(8)
       .font('Helvetica')
       .fillColor('#EAEAEA')
       .text(`${settings.company_address}   |   Tel: ${settings.company_phone}   |   Email: ${settings.company_email}`, margin + 20, contactBoxY + 30, {
         width: contentWidth - 40,
         align: 'center',
         lineGap: 4
       });

    doc.fontSize(7.5)
       .font('Helvetica')
       .fillColor('#999999')
       .text(`Working Hours: ${settings.working_hours}   |   WhatsApp: ${settings.company_whatsapp}`, margin + 20, contactBoxY + 52, {
         width: contentWidth - 40,
         align: 'center'
       });

    // ============================================================
    // CATALOG CONTENT PAGES
    // ============================================================
    // Group products by category
    const productsByCat = {};
    categories.forEach(c => { productsByCat[c.id] = []; });
    products.forEach(p => {
      if (p.category_id && productsByCat[p.category_id]) {
        productsByCat[p.category_id].push(p);
      } else {
        if (!productsByCat['other']) productsByCat['other'] = [];
        productsByCat['other'].push(p);
      }
    });

    // Helper: draw running header
    function drawHeader() {
      doc.rect(0, 0, pageWidth, 4).fill('#8B7355');
      doc.fontSize(7.5)
         .font('Helvetica-Bold')
         .fillColor('#888888')
         .text(settings.company_name.toUpperCase(), margin, 18, { characterSpacing: 1.2 });

      doc.fontSize(7.5)
         .font('Helvetica')
         .fillColor('#888888')
         .text('ARCHITECTURAL CATALOG & PRICE GUIDE', pageWidth - margin - 220, 18, { width: 220, align: 'right' });

      doc.lineWidth(0.5).strokeColor('#E5E2DC').moveTo(margin, 28).lineTo(pageWidth - margin, 28).stroke();
    }

    // Helper: prepare resized buffer for product thumbnail
    const thumbCache = {};
    async function getResizedThumbnail(imgRelativeUrl) {
      if (!imgRelativeUrl) return null;
      if (thumbCache[imgRelativeUrl]) return thumbCache[imgRelativeUrl];

      try {
        const cleanPath = imgRelativeUrl.startsWith('/') ? imgRelativeUrl.slice(1) : imgRelativeUrl;
        const fullPath = path.join(__dirname, '..', cleanPath);
        if (fs.existsSync(fullPath)) {
          const buf = await sharp(fullPath)
            .resize(220, 170, { fit: 'cover' })
            .jpeg({ quality: 80 })
            .toBuffer();
          thumbCache[imgRelativeUrl] = buf;
          return buf;
        }
      } catch (err) {
        // Fallback gracefully on image error
      }
      return null;
    }

    // Iterate through categories
    for (let cIdx = 0; cIdx < categories.length; cIdx++) {
      const cat = categories[cIdx];
      const catProds = productsByCat[cat.id] || [];
      if (catProds.length === 0) continue;

      // Start category on a fresh page
      doc.addPage();
      drawHeader();

      let curY = 44;

      // Category banner
      doc.rect(margin, curY, contentWidth, 38).fill('#1A1A1A');
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#C4A882').text(`COLLECTION 0${cIdx + 1}`, margin + 14, curY + 8, { characterSpacing: 1 });
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#FFFFFF').text(cat.name.toUpperCase(), margin + 14, curY + 18, { characterSpacing: 1.5 });
      doc.fontSize(8).font('Helvetica').fillColor('#D0D0D0').text(`${catProds.length} Specification${catProds.length !== 1 ? 's' : ''}`, pageWidth - margin - 120, curY + 16, { width: 106, align: 'right' });

      curY += 46;

      if (cat.description) {
        doc.fontSize(8.5).font('Helvetica').fillColor('#666666').text(cat.description, margin + 4, curY, { width: contentWidth - 8 });
        curY += 20;
      }

      // Draw products in a 2-column card layout
      const colGap = 14;
      const pColW = (contentWidth - colGap) / 2;
      const cardHeight = 158;

      for (let i = 0; i < catProds.length; i += 2) {
        // Check if page break is needed
        if (curY + cardHeight > pageHeight - margin - 30) {
          doc.addPage();
          drawHeader();
          curY = 44;
        }

        const rowProds = [catProds[i], catProds[i + 1]].filter(Boolean);

        for (let colIdx = 0; colIdx < rowProds.length; colIdx++) {
          const prod = rowProds[colIdx];
          const posX = margin + (colIdx * (pColW + colGap));
          const posY = curY;

          // Card boundary
          doc.rect(posX, posY, pColW, cardHeight).fillAndStroke('#FFFFFF', '#E5E2DC');

          // Left image container
          const imgW = 95;
          const imgH = cardHeight;
          doc.rect(posX, posY, imgW, imgH).fill('#F6F5F3');

          // Render thumbnail if available
          let renderedImg = false;
          if (prod.image_url) {
            const imgBuffer = await getResizedThumbnail(prod.image_url);
            if (imgBuffer) {
              try {
                doc.image(imgBuffer, posX + 4, posY + 8, { width: imgW - 8, height: imgH - 16, fit: [imgW - 8, imgH - 16], align: 'center', valign: 'center' });
                renderedImg = true;
              } catch (e) {}
            }
          }

          if (!renderedImg) {
            doc.fontSize(22).fillColor('#B0A99E').text('✦', posX + (imgW / 2) - 10, posY + (imgH / 2) - 14);
          }

          // Card content area
          const textX = posX + imgW + 10;
          const textW = pColW - imgW - 16;
          let textY = posY + 10;

          // Code pill
          doc.fontSize(7).font('Helvetica-Bold').fillColor('#8B7355').text(prod.code || 'ITEM', textX, textY, { characterSpacing: 0.8 });
          textY += 11;

          // Product Name
          doc.fontSize(10.5).font('Helvetica-Bold').fillColor('#1A1A1A').text(prod.name, textX, textY, { width: textW, ellipsis: true });
          textY += 15;

          // Price Tag
          const priceStr = fmtPrice(prod.price, prod.price_currency || 'ETB', prod.unit || 'm²');
          doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#8B7355').text(priceStr, textX, textY);
          textY += 14;

          // Divider
          doc.lineWidth(0.5).strokeColor('#ECE8E1').moveTo(textX, textY).lineTo(textX + textW, textY).stroke();
          textY += 7;

          // Specification rows
          const specs = [
            ['Dimensions:', prod.size || 'Standard'],
            ['Material:', prod.material || 'Architectural Stoneware'],
            ['Finish:', prod.finish || 'Matte / Glazed'],
            ['Color Tone:', prod.color || 'Neutral'],
          ];

          specs.forEach(([k, v]) => {
            doc.fontSize(7.2).font('Helvetica').fillColor('#888888').text(k, textX, textY, { width: 52 });
            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#333333').text(v, textX + 54, textY, { width: textW - 54, ellipsis: true });
            textY += 11;
          });

          // Short note / description
          if (prod.description) {
            textY += 3;
            doc.fontSize(6.8).font('Helvetica').fillColor('#777777').text(prod.description, textX, textY, { width: textW, height: 26, ellipsis: true });
          }
        }

        curY += cardHeight + 12;
      }
    }

    // ============================================================
    // FOOTER (Applied to all pages)
    // ============================================================
    const pagesCount = doc.bufferedPageRange().count;
    for (let pIdx = 0; pIdx < pagesCount; pIdx++) {
      doc.switchToPage(pIdx);
      doc.page.margins.bottom = 0;

      // Skip running footer on cover page
      if (pIdx === 0) continue;

      const fY = pageHeight - margin + 2;
      doc.lineWidth(0.5).strokeColor('#E0DCD5').moveTo(margin, fY - 8).lineTo(pageWidth - margin, fY - 8).stroke();

      doc.fontSize(7.2).font('Helvetica').fillColor('#888888')
         .text(`${settings.company_name} · ${settings.company_address}`, margin, fY, { lineBreak: false });

      doc.fontSize(7.2).font('Helvetica').fillColor('#888888')
         .text(`${settings.company_phone} · ${settings.company_email}`, margin + 180, fY, { width: 170, align: 'center', lineBreak: false });

      doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#111111')
         .text(`Page ${pIdx + 1} of ${pagesCount}`, pageWidth - margin - 70, fY, { width: 70, align: 'right', lineBreak: false });
    }

    // Finalize PDF stream
    doc.end();

  } catch (err) {
    console.error('PDF Generation Error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate catalog PDF: ' + err.message });
    }
  }
});

module.exports = router;
