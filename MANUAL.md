# SimMatch — Användarmanual

> **SimMatch** hjälper dig att para ihop rader från två olika filer – till exempel en leadslista med ditt CRM – även om namnen inte stavas exakt likadant.

---

## Innehåll

1. [Vad är SimMatch?](#1-vad-är-simmatch)
2. [Kom igång](#2-kom-igång)
3. [Välj matchningsmetod](#3-välj-matchningsmetod)
4. [Steg för steg – Namn + Stad-matchning](#4-steg-för-steg--namn--stad-matchning)
5. [Förstå resultatet i Excel](#5-förstå-resultatet-i-excel)
6. [Vanliga frågor och problem](#6-vanliga-frågor-och-problem)

---

## 1. Vad är SimMatch?

SimMatch jämför två listor och försöker hitta matchande rader – även om namnen stavas lite olika. Till exempel:

| Fil A (leadslistan) | Fil B (CRM) | Resultat |
|---------------------|-------------|---------|
| Bastard Burgers | Basterd Burgers Stockholm | ✅ Match (95%) |
| Hotell Frykenstrand | Frykenstrand Hotell & Konferens AB | ✅ Match (100%) |
| Operabaren | AB Operakällaren | ⚠️ Osäker match (84%) |

SimMatch ger varje möjlig matchning ett **poäng mellan 0 och 100**. Ju högre poäng, desto säkrare match.

---

## 2. Kom igång

Öppna SimMatch i din webbläsare. Du möts av startsidan med tre stora knappar:

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   SimMatch   Fuzzy matching for structured data         │
│                                                         │
│  ┌───────────┐  ┌─────────────────┐  ┌──────────────┐  │
│  │ ID Match  │  │  Name Match     │  │ Name + City  │  │
│  │           │  │                 │  │    Match     │  │
│  └───────────┘  └─────────────────┘  └──────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Vilken metod ska jag välja?

| Metod | Använd när… |
|-------|-------------|
| 🔢 **ID Match** | Du har ett unikt ID-nummer (org-nummer, ISRC, kundnummer) i båda filerna |
| 🔤 **Name Match** | Du bara har ett namnfält att matcha på |
| 🔤🏙️ **Name + City Match** | Du har både namn och stad i båda filerna – **rekommenderas** för restauranger och företag |

> 💡 **Tips:** Har du stadskolumner? Välj alltid **Name + City Match** – det ger betydligt bättre resultat eftersom ortnamnet hjälper algoritmen skilja på t.ex. "Bishops Arms Luleå" och "Bishops Arms Göteborg".

---

## 3. Välj matchningsmetod

Klicka på den metod du vill använda. Du kan alltid gå tillbaka med **← home**-länken längst upp på sidan.

---

## 4. Steg för steg – Namn + Stad-matchning

Guiden är uppdelad i **5 steg**. En stapel längst upp visar var du befinner dig.

---

### Steg 1 — Ladda upp Fil A (din leadslista)

```
┌────────────────────────────────────────────┐
│  Step 1 — Upload File A                    │
│  The file you want to enrich               │
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │                                      │  │
│  │        📂  Click to browse           │  │
│  │     eller dra och släpp filen hit    │  │
│  │                                      │  │
│  │    Stödda format: .xlsx .xls .csv    │  │
│  └──────────────────────────────────────┘  │
└────────────────────────────────────────────┘
```

**Gör så här:**
1. Klicka i den streckade rutan, eller dra din fil dit
2. Välj din Excel- eller CSV-fil
3. Vänta några sekunder – du ser texten *"Uploading…"* medan filen laddas upp
4. När uppladdningen är klar visas filnamnet och en förhandsvisning av datan

> ⚠️ **Filen måste ha rubriker** i den första raden (t.ex. "Namn", "Stad", "E-post"). SimMatch använder rubrikerna för att du ska kunna välja rätt kolumn.

---

### Steg 2 — Välj kolumner i Fil A och ladda upp Fil B

Nu ser du din uppladdade Fil A med en förhandsvisning. Under den väljer du vilka kolumner som ska användas vid matchningen.

```
┌────────────────────────────────────────────────┐
│  Fil A: leadslista.xlsx  (850 rader)           │
│                                                │
│  Namn        │ Stad      │ Adress   │ …        │
│  ──────────────────────────────────────        │
│  Farang      │ Stockholm │ …        │ …        │
│  Operabaren  │ Stockholm │ …        │ …        │
│                                                │
│  Name column:  [ Namn ▼ ]                      │
│  City column:  [ Stad ▼ ]                      │
└────────────────────────────────────────────────┘
```

**Välj kolumner:**
- **Name column** → välj den kolumn som innehåller restaurang-/företagsnamnet
- **City column** → välj den kolumn som innehåller ortnamnet

Ladda sedan upp **Fil B** (din referensfil, t.ex. CRM-exporten) på exakt samma sätt som Fil A.

---

### Steg 3 — Konfigurera

Nu ser du båda filerna och kan ställa in matchningen.

#### Välj kolumner i Fil B

Precis som för Fil A väljer du namn- och stadskolumnen i Fil B.

#### Extra kolumner (valfritt)

```
┌──────────────────────────────────────────────┐
│  Also include from File B (optional)         │
│                                              │
│  ☐ Org-nummer    ☐ E-post    ☐ Typ          │
│  ☐ Status        ☐ Telefon                  │
└──────────────────────────────────────────────┘
```

Bocka i de kolumner från Fil B som du vill ha med i resultatet (t.ex. org-nummer eller e-post). Det är **valfritt** – du kan hoppa över detta.

#### Tröskel för matchning

```
Match threshold:  85%
├─────────────────●──────────────────┤
50%                                 100%
Only highlight matches above 85%
```

Tröskeln avgör **hur säker en matchning måste vara** för att markeras som godkänd.

| Inställning | Innebär |
|------------|---------|
| **85%** (standard) | Bra balans – rekommenderas i de flesta fall |
| **Lägre (t.ex. 70%)** | Fler matchningar hittas, men fler kan vara felaktiga |
| **Högre (t.ex. 95%)** | Färre men säkrare matchningar |

> 💡 **Tips:** Börja med 85 %. Om du ser för många felaktiga matchningar i resultatet, höj till 90 %. Om du missar uppenbart korrekta matchningar, sänk till 80 %.

#### Starta matchningen

Klicka på den gula knappen **"Run Match"** när du är redo.

---

### Steg 4 — Matchningen körs

```
┌────────────────────────────────────────────┐
│  Running…                                  │
│                                            │
│  ████████████░░░░░░░░░░░░  48%            │
│  Matching…  482 / 1 000                   │
│                                            │
│                          [ Cancel ]        │
└────────────────────────────────────────────┘
```

SimMatch arbetar nu igenom alla rader. Beroende på filstorleken tar det några sekunder till någon minut. Du kan se förloppet i realtid.

> Du kan avbryta när som helst med **Cancel**.

---

### Steg 5 — Ladda ner resultatet

```
┌─────────────────────────────────────────────────────────┐
│  Match complete ✓                                       │
│                                                         │
│  Totalt  │ Matchningar │ Snitt-poäng │ Exakta          │
│  1 000   │ 847 (85%)   │ 94%         │ 312             │
│                                                         │
│  [ ⬇ Download Result Excel ]                           │
│                                                         │
│  [ Start New Match ]                                    │
└─────────────────────────────────────────────────────────┘
```

Klicka på **"Download Result Excel"** för att ladda ner din resultatfil.

Statistiken berättar:
- **Total rows** – Antal rader i din Fil A
- **Matches found** – Hur många som fick en matchning över tröskeln
- **Avg score** – Genomsnittlig matchningspoäng för alla matchade rader
- **Exact matches** – Rader som matchade med 100 %

---

## 5. Förstå resultatet i Excel

Resultatet är din ursprungliga Fil A med **nya kolumner tillagda på höger sida**.

### Kolumner i resultatet

| Kolumn | Vad den innehåller |
|--------|-------------------|
| *(Alla dina ursprungliga kolumner)* | Oförändrade från Fil A |
| **Match_Name** | Det namn som hittades i Fil B |
| **Match_City** | Orten för matchningen i Fil B |
| *(Eventuella extrakolumner)* | De kolumner du valde att ta med från Fil B |
| **Duplicate_Match** | "Yes" om flera rader pekar på samma post i Fil B |
| **Match_Score** | Matchningspoäng 0–100 |

---

### Färgkodning i Match_Score-kolumnen

Titta alltid på **färgen i Match_Score-kolumnen** för att snabbt bedöma kvaliteten:

```
┌──────────────────────────────────────────────────────────────┐
│  Namn               │ Match_Name          │ Score │ Färg     │
├──────────────────────────────────────────────────────────────│
│  Farang             │ Farang              │  100  │ ⬜ Vit   │
│  Hotell Frykenstrand│ Frykenstrand Hotell │   97  │ ⬜ Vit   │
│  Magari Pizza Kplan │ Magari Pizza        │  100  │ 🟧 Orange│
│  Magari Pizza Vstan │ Magari Pizza        │  100  │ 🟧 Orange│
│  Lofsdalens Fjällh. │ Lofsdalens Fjällanl │   83  │ 🟥 Röd  │
└──────────────────────────────────────────────────────────────┘
```

| Färg | Poäng | Vad det betyder | Vad du ska göra |
|------|-------|-----------------|-----------------|
| ⬜ **Vit** | ≥ tröskel (t.ex. 85) | Säker matchning | Inget behövs – godkänn |
| 🟧 **Orange** | ≥ tröskel | Säker matchning **men** flera poster i Fil A pekar på samma post i Fil B | Granska manuellt – välj vilken som är rätt |
| 🟥 **Röd** | < tröskel | Osäker eller ingen matchning | Granska manuellt |

---

### Vad gör jag med orange rader?

Orange rader betyder att **mer än en rad i din lista matchade samma post i CRM**. Det händer t.ex. när ett restaurangkedjor har flera ställen (Magari Pizza Karlaplan och Magari Pizza Vasastan matchar båda mot en enda "Magari Pizza" i CRM).

**Filtrera fram orangea rader i Excel:**
1. Klicka på en cell i kolumnen **Duplicate_Match**
2. Välj *Filtrera* → *"Yes"*
3. Granska de rader som visas och bestäm manuellt vilken som är korrekt match

---

### Vad gör jag med röda rader?

Röda rader innebär att SimMatch inte hittade en tillräckligt säker matchning. Det kan bero på:

- **Platsen finns inte i Fil B** – posten saknas i CRM
- **Namnet skiljer sig för mycket** – t.ex. helt olika namn (Svarta Hästen vs NK)
- **Tröskeln är för hög** – sänk tröskeln lite och kör om

---

## 6. Vanliga frågor och problem

---

### ❓ Filen laddas inte upp

**Kontrollera:**
- Att filen slutar på `.xlsx`, `.xls` eller `.csv`
- Att filen inte är öppen i Excel samtidigt (stäng den i Excel, prova igen)
- Att filen inte är lösenordsskyddad

---

### ❓ Jag ser inga kolumner att välja

**Kontrollera att:**
- Rad 1 i din fil innehåller **rubriker** (kolumnnamn)
- Filen inte är helt tom

---

### ❓ Allt hamnar i fel kolumn / konstiga tecken

Din fil kanske har fel teckenkodning. Spara om den i Excel som **"Excel-arbetsbok (.xlsx)"** och ladda upp på nytt.

---

### ❓ För många felaktiga matchningar

Höj tröskeln stegvis (t.ex. från 85 % till 90 %) och kör om matchningen.

---

### ❓ Korrekta matchningar saknas (röda rader som borde vara vita)

Sänk tröskeln stegvis (t.ex. från 85 % till 80 %). Kom ihåg att lägre tröskel kan ge fler felaktiga matchningar.

---

### ❓ Samma CRM-post matchas av många rader (orange)

Det är normalt om en kedja har flera ställen men bara en post i CRM. Du behöver manuellt avgöra vilken rad som är "rätt" match.

---

### ❓ Matchningspoängen verkar låg för ett uppenbart rätt par

Vanliga orsaker:
- **Stavfel** som är för stort (mer än 2–3 tecken)
- **Helt olika ordning** på ord (hanteras i de flesta fall automatiskt)
- **Synonymer** – t.ex. "fjällhotell" vs "fjällanläggningar" (algoritmen förstår inte att dessa betyder samma sak)

I dessa fall behöver du matcha manuellt.

---

*SimMatch — Internt verktyg. Vid frågor, kontakta den som administrerar systemet.*
