# National classifieds and machinery portals listing used wheel excavators in Europe (snapshot: 2026-11-07)

**How to read the evidence tags.** These notes rely on three levels of evidence, and they are not equally strong.
- **[FETCHED]**: the page loaded on 2026-11-07 and the count was read from it. Fetches went through an extraction model, so "private vs dealer" splits are often inferred from seller names and are labelled as such.
- **[INDEX ONLY]**: the fetch was blocked, but the URL appeared in search-engine results. Existence is supported; no count was seen on the live page.
- **[BLOCKED/UNVERIFIED]**: neither the page nor useful indexed evidence was available.

A blocked fetch says nothing about whether a site is healthy. It only means this research could not read it.

## Which national portals list used wheel excavators, and what is each one like? (URL, type, count, category, seller mix, caveats)

### Takeaway
The strongest verified national sources are Kleinanzeigen (DE), Otomoto and OLX (PL), Landwirt.com (AT), Marktplaats and 2dehands/2ememain (NL/BE), Bazos (CZ/SK), Jófogás Auto and Agroinform (HU), FINN B2B (NO), and Europe-TP (FR). Leboncoin, Subito and Milanuncios clearly carry real machines but blocked direct reading. Blocket, Willhaben and the Swiss portals could not be read at all. General classifieds searches are very noisy with toys, parts, services and rentals, so raw counts overstate real supply on every portal.

### Cited Findings

#### Germany
- **Kleinanzeigen** [FETCHED]: general classifieds. Search "mobilbagger" shows 1,497 results, of which 469 are private and 1,028 commercial. There are 1,040 tagged Baumaschinen, but also 114 under toys and 98 under home/garden services. No wheel-excavator-only category was seen; use search plus the Baumaschinen type filter. — [Kleinanzeigen search](https://www.kleinanzeigen.de/s-mobilbagger/k0)
- **Baupool** [BLOCKED/UNVERIFIED]: a guessed category URL returned HTTP 403, and a search for the name found no evidence of the portal. — [attempted URL](https://www.baupool.com/gebrauchte-baumaschinen/mobilbagger/)
- **Baumaschinen-portal.de** [BLOCKED/UNVERIFIED]: the fetch failed with a TLS error (unrecognized name). Active status not established. — [attempted URL](https://www.baumaschinen-portal.de/)

#### Austria
- **Landwirt.com, dealer and all-seller category** [FETCHED]: Austrian-rooted agricultural and construction machinery portal with a dedicated Mobilbagger category. It shows 193 listings, of which Austria 83, Germany 28, France 27, Bosnia 24, Netherlands 7, Sweden 6, Norway 5, Slovenia 5, Czech Republic 4, Denmark 3, Switzerland 1. All sellers visible among the first 48 were named businesses. A few are new or rental machines. — [Landwirt Mobilbagger](https://www.landwirt.com/baumaschinen/mobilbagger)
- **Landwirt.com, Kleinanzeigen section** [FETCHED]: the separate small-ads Mobilbagger page shows 31 results (Austria 29, Germany 1, Switzerland 1). 27 are tagged "Kleinanzeige" and 4 "Gewerblicher Anbieter". This is the most private-seller-heavy verified source for Austria. — [Landwirt Kleinanzeigen Mobilbagger](https://www.landwirt.com/kleinanzeigen/baumaschinen/mobilbagger)
- **Willhaben** [BLOCKED/UNVERIFIED]: the fetch tool refused the domain, and the search tool also refused it as a domain filter. No count or listing was seen. — [attempted URL](https://www.willhaben.at/iad/kaufen-und-verkaufen/marktplatz?keyword=mobilbagger)

#### Switzerland
- **Tutti, Ricardo, Anibis** [BLOCKED/UNVERIFIED]: all three returned HTTP 403, and searches surfaced no Pneubagger listings from them. The Tutti and Anibis URLs tried were constructed, not taken from the sites. — [Tutti](https://www.tutti.ch/de/q/alle/Ak6BwbmV1YmFnZ2VyksA?sorting=newest&page=1&query=pneubagger), [Ricardo](https://www.ricardo.ch/de/s/pneubagger/), [Anibis](https://www.anibis.ch/de/q/alle/Ak6BwbmV1YmFnZ2VyksA?query=pneubagger)
- **Landwirt.com** [FETCHED] shows only 1 Swiss listing in the main Mobilbagger category and 1 in the small-ads section, so it is not a meaningful Swiss source. — [main](https://www.landwirt.com/baumaschinen/mobilbagger), [Kleinanzeigen](https://www.landwirt.com/kleinanzeigen/baumaschinen/mobilbagger)

#### Netherlands
- **Marktplaats** [FETCHED]: general classifieds with a category "Machines en Bouw | Kranen en Graafmachines" (not wheel-specific). Results in that category: "mobiele graafmachine" 123, "bandenkraan" 28 (about 23 likely wheeled, by extractor estimate; 22 from business-named sellers, 6 unclear or likely private). These queries overlap. — [mobiele graafmachine](https://www.marktplaats.nl/l/zakelijke-goederen/machines-en-bouw-kranen-en-graafmachines/q/mobiele+graafmachine/), [bandenkraan](https://www.marktplaats.nl/l/zakelijke-goederen/machines-en-bouw-kranen-en-graafmachines/q/bandenkraan/)
- The all-site search "mobiele kraan" shows 834 results but only 121 in the machinery category; the rest include Lego, model cars, toilets, and tower-crane rentals. Avoid it uncategorised. Seller type is not labelled. — [Marktplaats search](https://www.marktplaats.nl/q/mobiele+kraan/)

#### Belgium
- **2dehands (Dutch)** [FETCHED]: sister-format classifieds. "mobiele kraan" shows 186 results, with 32 in Kranen en Graafmachines, and only a few of the visible listings are wheeled excavators. Sellers appear mostly business, inferred from names. — [2dehands search](https://www.2dehands.be/q/mobiele+kraan/)
- **2ememain (French)** [FETCHED]: "pelle sur pneus" shows 47 results, with 18 in Cranes & Excavators. 10 of 30 visible were clearly wheel excavators, priced €7,750 to €72,900 where shown; 6 of those 10 from business-looking sellers. — [2ememain search](https://www.2ememain.be/q/pelle+sur+pneus/)

#### France
- **Europe-TP** [FETCHED]: French-language used construction equipment classifieds, part of the Via Mobilis group, with a dedicated category of 830 listings. **Only 237 are in France**; Germany 151, Netherlands 136, Poland 97, China 59, Belgium 45. By type: 786 buy, 41 auction, 3 rental; 25 are new. 557 show a price. No pro/private split is given, but 54 are "verified sellers" and sampled sellers were businesses. — [Europe-TP pelle sur pneus](https://www.europe-tp.com/pelle-sur-pneus/2-1-v3/pelle-sur-pneus-occasion.html), [Europe-TP home](https://www.europe-tp.com/)
- **Leboncoin** [INDEX ONLY]: direct search returned HTTP 403. Indexed keyword pages sit in the "BTP - Chantier gros-oeuvre" category and also in "Matériel agricole". Brand-specific pages exist for Liebherr, Doosan and Takeuchi. Search output indicates some sellers are labelled professional, but no count was seen on a live page. — [pelle à pneu](https://www.leboncoin.fr/ck/btp_chantier_gros_oeuvre/pelle-%C3%A0-pneu), [matériel agricole](https://www.leboncoin.fr/ck/materiel_agricole/pelle-a-pneu), [Liebherr](https://www.leboncoin.fr/ck/btp_chantier_gros_oeuvre/pelle-a-pneus-liebherr)
- **ParuVendu** [INDEX ONLY]: national classifieds with a construction-machinery section; direct fetch returned HTTP 403, and no count was seen. — [ParuVendu engins de chantier](https://www.paruvendu.fr/a/utilitaire-occasion/engin-de-chantier/?p=3)
- **Landwirt.com, French interface** [FETCHED]: same 193-listing dataset, with France at 27. — [Landwirt FR](https://www.landwirt.com/fr/engins-de-chantier/pelles-sur-pneus)

#### Italy
- **Subito** [INDEX ONLY]: direct fetch returned HTTP 403. Indexed national and regional search pages exist for Lombardy and Piedmont, and the search-tool summary described real machines (Case M488P, Liebherr A314, Komatsu PW140-7, New Holland), often priced "+ IVA", plus a public online auction lot and a broker. No count was seen. — [Subito motori](https://www.subito.it/annunci-italia/vendita/motori/?q=escavatore+gommato), [Lombardia](https://www.subito.it/annunci-lombardia/vendita/usato/?q=escavatore+gommato), [Piemonte](https://www.subito.it/annunci-piemonte/vendita/usato/?q=escavatore+gommato)
- **Edilizia.com** [INDEX ONLY]: appeared as an Italian dealer-profile directory rather than a listings portal. Useful for finding dealers only; not opened. — [dealer profile example](https://www.edilizia.com/azienda/piccinini-macchine-s-r-l/)

#### Spain
- **Milanuncios** [INDEX ONLY]: direct fetch returned HTTP 405. It has indexed "maquinaria" keyword pages, including national and provincial versions. One indexed page title reads "127 Excavadoras ruedas de segunda mano en Madrid Provincia", which is an index snapshot, possibly stale and likely including non-wheeled machines. The search-tool summary reported real machines (Liebherr A934 C, Cat M322C, Case WX200, Doosan DX190W) and notes that some prices exclude tax and some machines lack documentation. — [Milanuncios maquinaria](https://www.milanuncios.com/maquinaria/excavadora-ruedas.htm), [Madrid](https://www.milanuncios.com/maquinaria-en-madrid/excavadoras-ruedas.htm), [Galicia](https://www.milanuncios.com/maquinaria-en-galicia/excavadoras-ruedas.htm)

#### Poland
- **Otomoto** [FETCHED]: vehicle and machinery classifieds with a **dedicated "Koparki kołowe" category showing 708 listings**. Of 32 visible listings, 9 were private and 23 business. Four showed "netto" pricing; the others had no VAT label. A search index snapshot showed 654, so the count moves. This is the only verified portal with a large dedicated wheeled category and an explicit seller label. — [Otomoto koparki kołowe](https://www.otomoto.pl/maszyny-budowlane/koparki-kolowe)
- **OLX.pl** [FETCHED]: category "Koparki kołowe i gąsienicowe" **combines wheeled and tracked**. The page says "ponad 1000" for the query "kołowa", and that figure is a cap, not a count of wheel excavators. About 24 of 52 visible had "kołowa" in the title, and about 9 more had wheeled model codes (extractor estimate). It has a Firmowe/Prywatne filter. Some OLX results link to Otomoto, so the two overlap. — [OLX category](https://www.olx.pl/motoryzacja/budowlane/koparki-kolowe-i-gasienicowe/q-ko%C5%82owa/), [OLX all-site search](https://www.olx.pl/oferty/q-koparka-ko%C5%82owa/)
- **Allegro Lokalnie** [FETCHED]: "koparka kołowa" shows 49 offers (27 from Allegro, 22 from Allegro Lokalnie), mixing real machines (JCB JS145W, JCB 110W Hydradig) with Lego and models. No dedicated category seen. The page was truncated, so the real share is unknown. — [Allegro Lokalnie search](https://allegrolokalnie.pl/oferty/q/koparka%20ko%C5%82owa)
- **truck.pl** [INDEX ONLY]: a Polish machinery listing site with a "koparki-kołowe" path in indexed listings. Not opened, no count seen. — [truck.pl listing](https://truck.pl/pl/d/maszyny-budowlane/koparki-kołowe/koparka-kołowa-cat-m317f-642386141)

#### Czech Republic
- **Bazos.cz, Stroje section** [FETCHED]: "kolové rýpadlo" shows 59 ads. About 37 of the 40 shown were wheel excavators, which makes this the cleanest general-classifieds result verified. Seller type isn't labelled; several share a dealer template around Kolín, others read as private. — [Bazos.cz search](https://stroje.bazos.cz/inzeraty/kolove-rypadlo/)
- **Sbazar** [FETCHED]: active, but "kolové rýpadlo" returned 2 results and neither was an excavator. Effectively no supply for this query. — [Sbazar search](https://www.sbazar.cz/hledej/kolov%C3%A9%20r%C3%BDpadlo)
- **Tipcars** [INDEX ONLY]: section fetch returned HTTP 403. One indexed work-machine ad for a DH 112 wheel excavator from a bazaar seller, priced with VAT stated separately. — [Tipcars listing](https://www.tipcars.com/pracovni-stroje/ostatni/ostatni-dh-112-16457052.html)

#### Slovakia
- **Bazos.sk, Stroje section** [FETCHED]: "kolesové rýpadlo" shows 34 ads, 32 of them real wheel excavators. About 18 are located in the Czech Republic and share one dealer-style template, so genuine Slovak supply is smaller. — [Bazos.sk search](https://stroje.bazos.sk/inzeraty/kolesove-rypadlo/)
- **Landwirt.com, Slovak interface** [INDEX ONLY]: has a localised wheel-excavator category path. Same multi-country dataset, not separately counted. — [Landwirt SK](https://www.landwirt.com/sk/stroje-na-stavbu/bager-s-gumovymi-kolesami?page=3)
- **Autobazar.eu**: a guessed URL returned 404, so nothing was established. — [attempted URL](https://www.autobazar.eu/vysledky-stavebne-stroje/?q=kolesove+rypadlo)

#### Hungary
- **Jófogás Auto subdomain** [FETCHED]: "gumikerekes kotro" shows 34 results, 31 real wheeled excavators. **27 come from one dealer (Agrosprinter)**; 2 from other traders and only 2 from private sellers. — [Jófogás Auto](https://auto.jofogas.hu/magyarorszag/jarmu?q=gumikerekes+kotro)
- **Jófogás main site** [FETCHED]: the same term returned 3 results, none of them machines. The main site can easily be mistaken for having no supply. — [Jófogás main](https://www.jofogas.hu/magyarorszag?q=gumikerekes%20kotr%C3%B3)
- **Agroinform Piactér** [FETCHED]: Hungarian agricultural portal with a "Forgógémes rakodó" category showing 483 listings, combining wheeled and tracked. Drive type isn't reliably stated. It has a Gazda/Kereskedő filter without counts. Indexed ads include a Komatsu PW160-11 and a Schaeff HML 30. — [Agroinform category](https://www.agroinform.hu/aprohirdetes/gep/rakodogepek-es-epitoipari-gepek/onjaro-forgogemes-rakodo-10991/c3), [Komatsu ad](https://www.agroinform.hu/aprohirdetes_adatlap/gep/rakodogepek-es-epitoipari-gepek/gumikerekes-kotro-komatsu-pw160-11-2100-uzemora/h_7540762)
- **Használtautó.hu** [BLOCKED/UNVERIFIED]: HTTP 403 on a guessed URL. Not established as a source. — [attempted URL](https://www.hasznaltauto.hu/kereses?q=kotro)

#### Romania
- **OLX.ro** [FETCHED]: "excavator pe roti" says "peste 1.000" results, but the sidebar shows only 95 in Agro și industrie and 49 in rentals, and 50 in Mama și copilul, so the headline count is not meaningful. A dealer (Baumachine Alexa Ratez) posted about six of the visible listings; some link out to Autovit. — [OLX.ro search](https://www.olx.ro/oferte/q-excavator-pe-roti/)
- **BestAuto.ro** [mixed]: a guessed "excavator" page returned 0 results, but indexed county pages exist under Utilaje, and the search summary mentioned wheeled machines such as a Hitachi ZX140W-6 and a Case 18 t. Treat as a lead only. — [excavator page](https://www.bestauto.ro/utilaje/excavator/), [Ilfov](https://www.bestauto.ro/utilaje/ilfov/?pag=3), [Cluj](https://www.bestauto.ro/utilaje/cluj/?pag=13)
- **Autovit** [BLOCKED/UNVERIFIED]: a guessed URL returned 404; its existence is implied only by OLX.ro links. — [attempted URL](https://www.autovit.ro/utilaje/excavatoare)

#### Sweden
- **Blocket** [BLOCKED/UNVERIFIED]: the fetch tool refused the domain and the search tool refused it as a filter. Nothing was seen. — [attempted URL](https://www.blocket.se/annonser/hela_sverige?q=hjulgr%C3%A4vare)
- **KVD (kvd.se)** [FETCHED]: Swedish used vehicle and machinery marketplace with auction and fixed-price modes. It showed 66 items across all machine types; of 20 visible, one was a hjulgrävare (Terex TW110, at auction). Auction-weighted, so it partly overlaps with auction research. — [KVD](https://www.kvd.se/transport-och-maskin)
- **Axima (begagnat.axima.se)** [INDEX ONLY]: a single-dealer stock page with a hjulgrävare section, not a marketplace; described as mostly price-on-request. — [Axima](https://begagnat.axima.se/aximanew/entreprenad/hjulgravare)
- Landwirt.com shows 6 Swedish Mobilbagger listings. — [Landwirt](https://www.landwirt.com/baumaschinen/mobilbagger)

#### Denmark
- **Maskinbladet** [FETCHED]: Danish trade-press machinery marketplace with "Gravemaskiner" and a third-level category "Gravemaskiner på hjul". The free-text "hjulgraver" does **not** narrow the list: 727 results, and only 2 of 24 visible were tagged wheeled (Hydrema MX14 and MX16, both at auction). All visible sellers were businesses, and the page says machines are sold by official dealers. — [Maskinbladet gravemaskiner](https://www.maskinbladet.dk/maskiner/gravemaskiner-cc33c2680-a88d-4c39-a327-3c6c921ea7e0?query=hjulgraver)
- **DBA** [FETCHED]: general classifieds. "hjulgraver" shows 53 results; few are real wheel excavators (Volvo EW60E, Takeuchi TB295 W), alongside toys, tyres, and crawlers. Mostly business names where shown. — [DBA search](https://www.dba.dk/soeg/?soeg=hjulgraver)

#### Norway
- **FINN B2B construction** [FETCHED]: search in the construction machinery section shows **67 results, 66 dealer and 1 private**. Most of those read are real (Liebherr 916, Komatsu PW148-8, Cat M317, Volvo EW, Åkerman H3M). The page was only partly read. VAT was not visible in the extract. — [FINN B2B](https://www.finn.no/mobility/search/b2b/construction?q=hjulgraver)
- **FINN Torget (recommerce)** [FETCHED]: 53 results, mostly parts, toys and unrelated items, plus a wanted ad and a few small machines. This is the wrong section for machines. — [FINN recommerce](https://www.finn.no/recommerce/forsale/search?q=hjulgraver)

#### Finland
- **Tori.fi** [FETCHED]: "pyöräkaivuri" shows 23 results, with none clearly a real wheel excavator: toys, buckets, services, loaders, and excavators of unclear type. — [Tori search](https://www.tori.fi/recommerce/forsale/search?q=py%C3%B6r%C3%A4kaivuri)
- **Nettikone** [BLOCKED/UNVERIFIED]: both the home page and a guessed category URL looped through an SSO redirect, so no content was read. — [attempted URL](https://www.nettikone.com/)
- **Konepörssi** [FETCHED]: a work-machine news and magazine site with no listings seen. It appears to be ending: a post is titled "Konepäivät jatkuvat – Konepörssi päättyy", and a banner mentions the final issue. — [Konepörssi](https://www.koneporssi.com/)
- **koneenvalitys.fi**: suggested by a search summary, but the hostname `www.koneenvalitys.fi` did not resolve (DNS failure). Do not rely on it. — [attempted URL](https://www.koneenvalitys.fi/)

#### United Kingdom
- **Autotrader Plant** [FETCHED]: a dedicated "Wheeled Excavators" category showing "24 used Wheeled Excavators". Of 20 readable, 11 were "+VAT", 6 "POA +VAT", 2 "No VAT", and 1 unmarked. Owner-operated and retirement sales appear. Listings include a JCB 2CX, JCB 3CX Sitemaster, Cat 428F and New Holland LB110.B. — [Autotrader Plant](https://www.autotrader.co.uk/plant/plant-machinery/excavators/wheeled-excavators)
- **Plant & Equipment** [FETCHED]: despite the name it now reads as a global marketplace. The query returned 37,829 construction listings under a loose search; UK facet 747, US 9,982, China 9,534, Netherlands 6,045. None of the first ~30 were titled wheeled excavators, and an assumed category URL returned 404. Not a UK national wheel-excavator source. — [search](https://www.plantandequipment.com/search-machinery?q=wheeled+excavator), [home](https://www.plantandequipment.com/)
- **Gumtree** [FETCHED]: 7 ads, none a clear full-size wheeled excavator (models, Lego, a magazine). — [Gumtree search](https://www.gumtree.com/search?search_category=all&q=wheeled+excavator)
- **S J Hall Plant** [INDEX ONLY]: a single-dealer stock page rather than a marketplace. — [SJH All Plant](https://www.sjhallplant.com/used-machinery/wheeled-excavators)

#### Cross-cutting caveats
- **Scam risk:** the search-tool summary of the Deutsche Handwerks-Zeitung article describes fake excavator and construction-machine listings at low prices, with deposits or "escrow" prepayment requested. The article itself was not opened. — [Deutsche Handwerks-Zeitung](https://www.deutsche-handwerks-zeitung.de/?p=346546)
- **Scam risk, individual report:** an eBay community user reports a fake mini-excavator listing and a €2,200 loss. This is one unverified anecdote, read only through the same summary. — [eBay community](https://community.ebay.de/t5/Archiv-eBay-Sicherheit/Minibagger-Betrug/qaa-p/3659145)
- **Platform claim:** mobile.de says it scans listings for fraud and checks new dealers. This is the company's own statement; mobile.de's excavator supply itself was not checked. — [mobile.de](https://www.mobile.de/sicherheit/sicherheitsfunktionen/mobilede-vs-betrug)

### Inferences
- **Best fit for buyers international searchers miss:** Bazos.cz/.sk, Jófogás Auto, Agroinform, Otomoto's private sellers, and Landwirt's Kleinanzeigen. They are local-language and have verified real machines. The strongest private-seller signals are Kleinanzeigen (469 private across all categories, which is not a wheel-excavator count) and Landwirt Kleinanzeigen.
- **The section matters as much as the portal.** FINN B2B gave mostly real machines and FINN Torget mostly noise. Jófogás Auto gave 31 real machines and its main site none. A scraper or buyer using the wrong section would wrongly conclude that a country has no supply.
- **Autotrader's true count is probably below 24.** The JCB 2CX, 3CX, Cat 428F and LB110.B are, to my knowledge, backhoe loaders rather than slew excavators, so the category appears contaminated. This is my reading, not a statement by the page.
- **Duplication is likely.** The same dealers (Bosmans Machines, Bulten Bouwkranen) appear on both Marktplaats and 2dehands. Czech dealer templates appear on Bazos.sk, and OLX.pl and OLX.ro link to Otomoto and Autovit. Summing counts across portals would overstate supply.
- **Europe-TP is French-language, not France-only.** Using 830 as the French figure would overstate it by about 3.5 times; 237 is the relevant figure.
- **Dealer-dominated supply:** FINN B2B, Maskinbladet, Landwirt's main category and Jófogás Auto are almost entirely commercial, so prices there probably exclude VAT or reflect a dealer margin. Confirm VAT per ad. Otomoto's "netto" tags and Autotrader's "+VAT" show the difference can be material.
- **Spanish term risk:** "retroexcavadora mixta" appears to mean a backhoe, not a wheel excavator, so it should be excluded from Spanish queries.
- **Payment practice (my judgement, drawn from the scam reporting above):** do not prepay deposits before inspection, especially for below-market ads on general classifieds.

### Gaps
- **Unreadable high-priority portals:** Blocket, Willhaben, Tutti, Ricardo and Anibis gave no usable data. Leboncoin, Subito and Milanuncios are index-only. All need a manual browser check for real counts.
- **Switzerland and Sweden have no verified national classifieds source.** This reflects the tools, not evidence of absent supply.
- **Finland:** the main candidate, Nettikone, could not be read, and Tori showed no clear real machines.
- **Not found or not checked:** national vertical portals for Italy and Spain (searches returned mainly pan-European sites); Wallapop; Kleinanzeigen's direct category URL; mobile.de; a Dutch or Belgian machinery-only portal; the direct URL for Maskinbladet's "Gravemaskiner på hjul" category.
- **Baupool, Baumaschinen-portal, Használtautó and Autovit:** not confirmed as wheel excavator sources. Some attempted URLs were guesses, so a 403 or 404 there does not prove the portal lacks them.
- **No portal-specific evidence on scams or fraud rates** for wheel excavators was found, and no 2026 statistics.
- **Private/dealer splits** are only platform-reported on Kleinanzeigen, Otomoto (visible sample), FINN B2B, Landwirt Kleinanzeigen and Jófogás Auto. Others are inferred from names.

## What is the local search term for wheel excavator in each language?

### Takeaway
Terms below were observed in live use on portals, except where noted. Dutch and Finnish have the biggest pitfalls, because "mobiele kraan" and "pyöräkaivuri" pull in a lot of noise. The Swiss term differs from the German one.

### Cited Findings
- **German (DE/AT):** Mobilbagger — [Kleinanzeigen](https://www.kleinanzeigen.de/s-mobilbagger/k0), [Landwirt](https://www.landwirt.com/baumaschinen/mobilbagger). Also Radbagger, seen in a marketplace listing URL — [Machineseeker](https://www.machineseeker.no/m-craiova+ih+radbagger+%28+romania+%29+mit+2+schalengr/i-22312402).
- **Swiss German:** Pneubagger, seen in Swiss job ads rather than sales ads — [jobup.ch](https://www.jobup.ch/en/jobs/detail/9bbf900f-450e-4b7e-9d7d-5eae0d99272d/).
- **Dutch (NL/BE):** bandenkraan and mobiele graafmachine give the cleanest results; mobiele kraan is noisy — [bandenkraan](https://www.marktplaats.nl/l/zakelijke-goederen/machines-en-bouw-kranen-en-graafmachines/q/bandenkraan/), [mobiele graafmachine](https://www.marktplaats.nl/l/zakelijke-goederen/machines-en-bouw-kranen-en-graafmachines/q/mobiele+graafmachine/). Wielgraafmachines is used in a category path — [Mascus NL](https://mascus.nl/bouw/wielgraafmachines/atlas-1404-hjulgravare/rmshmfto.html).
- **French (FR/BE/CH):** pelle sur pneus; also pelle à pneu / pelle a pneus — [Europe-TP](https://www.europe-tp.com/pelle-sur-pneus/2-1-v3/pelle-sur-pneus-occasion.html), [Leboncoin](https://www.leboncoin.fr/ck/btp_chantier_gros_oeuvre/pelle-%C3%A0-pneu).
- **Italian:** escavatore gommato / escavatori gommati — [Subito](https://www.subito.it/annunci-italia/vendita/motori/?q=escavatore+gommato).
- **Spanish:** excavadora de ruedas; excavadora giratoria ruedas — [Milanuncios](https://www.milanuncios.com/maquinaria/excavadora-ruedas.htm), [giratoria](https://www.milanuncios.com/motor/excavadora-giratoria-ruedas.htm).
- **Polish:** koparka kołowa / koparki kołowe — [Otomoto](https://www.otomoto.pl/maszyny-budowlane/koparki-kolowe).
- **Czech:** kolové rýpadlo (Bazos slug: kolove-rypadlo) — [Bazos.cz](https://stroje.bazos.cz/inzeraty/kolove-rypadlo/).
- **Slovak:** kolesové rýpadlo; also bager s gumovými kolesami — [Bazos.sk](https://stroje.bazos.sk/inzeraty/kolesove-rypadlo/), [Landwirt SK](https://www.landwirt.com/sk/stroje-na-stavbu/bager-s-gumovymi-kolesami?page=3).
- **Hungarian:** gumikerekes kotró; gumikerekes forgó-kotró; broader category "forgógémes rakodó" — [Jófogás Auto](https://auto.jofogas.hu/magyarorszag/jarmu?q=gumikerekes+kotro), [Agroinform ad](https://www.agroinform.hu/aprohirdetes_adatlap/gep/rakodogepek-es-epitoipari-gepek/gumikerekes-forgo-kotro-elado/h_7513749), [Agroinform category](https://www.agroinform.hu/aprohirdetes/gep/rakodogepek-es-epitoipari-gepek/onjaro-forgogemes-rakodo-10991/c3).
- **Romanian:** excavator pe roți (search without diacritics also works) — [OLX.ro](https://www.olx.ro/oferte/q-excavator-pe-roti/).
- **Swedish:** hjulgrävare — [KVD](https://www.kvd.se/transport-och-maskin), [Axima](https://begagnat.axima.se/aximanew/entreprenad/hjulgravare).
- **Danish:** hjulgraver; category label "Gravemaskiner på hjul" — [Maskinbladet](https://www.maskinbladet.dk/maskiner/gravemaskiner-cc33c2680-a88d-4c39-a327-3c6c921ea7e0?query=hjulgraver).
- **Norwegian:** hjulgraver — [FINN B2B](https://www.finn.no/mobility/search/b2b/construction?q=hjulgraver).
- **Finnish:** pyöräalustainen kaivinkone, seen in a category path; pyöräkaivuri is a colloquial form that returned noise on Tori — [Truck1 FI](https://www.truck1.fi/rakennuskoneet/pyoraalustainen-kaivinkoneet/komatsu-pw160-11-a5793013.html), [Tori](https://www.tori.fi/recommerce/forsale/search?q=py%C3%B6r%C3%A4kaivuri).
- **English (UK):** wheeled excavator — [Autotrader Plant](https://www.autotrader.co.uk/plant/plant-machinery/excavators/wheeled-excavators).

### Inferences
- "grävmaskin hjul" from the brief was not observed as a standard term; hjulgrävare is what Swedish sites use.
- Searching model codes (PW160, EW140, M316, A914, 140W) alongside the local term is likely to catch ads that omit the type word, as Agroinform's and OLX's titles suggest.

### Gaps
- Pneubagger was only observed in job ads, because Swiss classifieds were blocked.
- Whether "pyöräkaivinkone" outperforms other Finnish terms was not tested, since it came only from a search summary.
- Results for "pelle mobile" (FR), "Radbagger" and "wielgraafmachine" as portal queries were not tested.

## Is each portal active in 2026?

### Takeaway
Every portal tagged [FETCHED] served live results on 2026-11-07. The one clear decline signal is Konepörssi, which appears to be ending but was not a confirmed listings source anyway. Sbazar is live but has no relevant supply for this query.

### Cited Findings
- **Explicit 2026 evidence on the page:** Marktplaats titled its results "november 2026" — [Marktplaats](https://www.marktplaats.nl/q/mobiele+kraan/). Europe-TP shows early-November 2026 news and a 258,029-listing total — [Europe-TP](https://www.europe-tp.com/). Landwirt shows a 2026 copyright and listings "seit gestern", read on a sibling Bagger small-ads page — [Landwirt Kleinanzeigen Bagger](https://www.landwirt.com/Kleinanzeigen/angebote-Bagger,89.html).
- **Live results on fetch, without an explicit date:** Kleinanzeigen, 2dehands, 2ememain, Otomoto, OLX.pl, OLX.ro, Allegro Lokalnie, Bazos.cz, Bazos.sk, Sbazar, Jófogás, Agroinform, DBA, FINN, Tori, Maskinbladet, Autotrader Plant, Gumtree, Plant & Equipment, KVD (links in the first section).
- **Ending:** Konepörssi carries a post titled "Konepörssi päättyy" and refers to its last issue, while still publishing articles dated up to 2026-11-06 — [Konepörssi](https://www.koneporssi.com/).
- **Plant & Equipment** looks current, with 2026 model-year items and live auction tabs, but the fetched content may be a cached snapshot — [Plant & Equipment](https://www.plantandequipment.com/).

### Inferences
- Leboncoin, Subito, Milanuncios and ParuVendu are very likely active, given their indexed listing pages. The 403/405 responses look like anti-bot behaviour rather than outages, but this was not proven from the responses.

### Gaps
- 2026 activity could not be confirmed for Willhaben, Blocket, Tutti, Ricardo, Anibis, Nettikone, Baupool, Baumaschinen-portal, Használtautó, Tipcars, Autovit or truck.pl.
- Index-only pages have no reliable crawl dates, so their listings may be old.
