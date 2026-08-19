# Advisory template review — every string a citizen can receive, per language

The advisories are **deterministic templates** (no language model): one sentence per risk tier,
rendered by `agents/advisory.py::render_message` and checked by `script_ok()` (target script present, no
foreign-script characters). This sheet lists **every** rendered string so a native speaker can review
wording, register and medical appropriateness in ~10 minutes per language. Reviewer notes go in the
last column; a language is marked *reviewed* only when a named-role reviewer (not named person) has
signed off — the status column below is the single source of truth quoted by the docs.

| language | status | reviewed on |
|---|---|---|
| English (`en`) | authored in English | – |
| Hindi (`hi`) | reviewed by a native speaker (team member) — wording and advice confirmed | 2026-08-18 |
| Kannada (`kn`) | deterministic + script-validated; native-speaker review pending | – |
| Marathi (`mr`) | reviewed by a native speaker (team member) — wording and advice confirmed | 2026-08-18 |
| Tamil (`ta`) | deterministic + script-validated; native-speaker review pending | – |
| Telugu (`te`) | deterministic + script-validated; native-speaker review pending | – |
| Bengali (`bn`) | deterministic + script-validated; native-speaker review pending | – |
| Gujarati (`gu`) | deterministic + script-validated; native-speaker review pending | – |


## IVR call framing — the sentences spoken around the advisory

*Added 19 Aug 2026.* A phone call is not just the advisory: it opens by naming the city, says
who is calling, announces the repeat, and closes. Those four sentences were **English for every
language except Hindi**, so a Marathi call opened and closed in English even once the voice was
right. They are script-validated in `tests/test_ivr_voices.py` but **none has been reviewed by a
native speaker yet — including Marathi and Hindi, whose advisory *bodies* above have been.**
Spoken word order and register matter more here than in a written card, so this needs the same
ten-minute pass.

| language | intro | who is calling | repeat | close |
|---|---|---|---|---|
| English (`en`) | Here is the latest advisory for {city}. | This is an air quality alert from {brand}. | I will now repeat this alert. | Stay safe, and limit outdoor exposure. Goodbye. |
| Hindi (`hi`) | {city} के लिए नवीनतम सलाह। | यह {brand} की ओर से वायु गुणवत्ता चेतावनी है। | मैं यह चेतावनी दोहराती हूँ। | सुरक्षित रहें, बाहर कम समय बिताएँ। धन्यवाद। |
| Marathi (`mr`) | {city} साठी नवीनतम सूचना. | ही {brand} कडून हवा गुणवत्ता सूचना आहे. | मी ही सूचना पुन्हा सांगते. | सुरक्षित राहा, बाहेर कमी वेळ घालवा. धन्यवाद. |
| Kannada (`kn`) | {city} ಗಾಗಿ ಇತ್ತೀಚಿನ ಸೂಚನೆ. | ಇದು {brand} ಕಡೆಯಿಂದ ಗಾಳಿ ಗುಣಮಟ್ಟದ ಎಚ್ಚರಿಕೆ. | ನಾನು ಈ ಎಚ್ಚರಿಕೆಯನ್ನು ಮತ್ತೆ ಹೇಳುತ್ತೇನೆ. | ಸುರಕ್ಷಿತವಾಗಿರಿ, ಹೊರಗೆ ಕಡಿಮೆ ಸಮಯ ಕಳೆಯಿರಿ. ಧನ್ಯವಾದಗಳು. |
| Tamil (`ta`) | {city} க்கான சமீபத்திய அறிவிப்பு. | இது {brand} சார்பாக காற்று தர எச்சரிக்கை. | இந்த எச்சரிக்கையை மீண்டும் சொல்கிறேன். | பாதுகாப்பாக இருங்கள், வெளியே குறைந்த நேரம் செலவிடுங்கள். நன்றி. |
| Telugu (`te`) | {city} కోసం తాజా సూచన. | ఇది {brand} నుండి గాలి నాణ్యత హెచ్చరిక. | ఈ హెచ్చరికను మళ్లీ చెబుతాను. | సురక్షితంగా ఉండండి, బయట తక్కువ సమయం గడపండి. ధన్యవాదాలు. |
| Bengali (`bn`) | {city} এর জন্য সাম্প্রতিক পরামর্শ। | এটি {brand} থেকে বায়ু মানের সতর্কতা। | আমি এই সতর্কতা আবার বলছি। | নিরাপদে থাকুন, বাইরে কম সময় কাটান। ধন্যবাদ। |
| Gujarati (`gu`) | {city} માટે તાજેતરની સૂચના. | આ {brand} તરફથી હવા ગુણવત્તા ચેતવણી છે. | હું આ ચેતવણી ફરીથી કહું છું. | સુરક્ષિત રહો, બહાર ઓછો સમય વિતાવો. આભાર. |

`{city}` and `{brand}` are substituted at run time. **Both stay in Latin script**, so a
non-Latin voice reads "Mumbai" and "Vayu Netra" as foreign words — the residual fluency gap,
and the next thing to fix if a reviewer says it grates.

Rendering used: city = *Delhi*, ward = *Ward 12*, horizon = 24 h. Change nothing in the code to review —
only the words matter; the numbers and place names are substituted at run time.

## English (`en`)

| tier | rendered advisory | script_ok | reviewer note |
|---|---|---|---|
| good | Delhi Ward 12: air is forecast good in +24h. Air is fine — normal outdoor activity is safe. | ✓ | |
| satisfactory | Delhi Ward 12: air is forecast satisfactory in +24h. Air is fine — normal outdoor activity is safe. | ✓ | |
| moderate | Delhi Ward 12: air is forecast moderate in +24h. Sensitive people (children, elderly, asthma) should limit long outdoor exertion. | ✓ | |
| poor | Delhi Ward 12: air is forecast poor in +24h. Keep outdoor activity short, use an N95 mask, and move heavy work outside the peak window. | ✓ | |
| very_poor | Delhi Ward 12: air is forecast very poor in +24h. Keep outdoor activity short, use an N95 mask, and move heavy work outside the peak window. | ✓ | |
| severe | Delhi Ward 12: air is forecast severe in +24h. Keep outdoor activity short, use an N95 mask, and move heavy work outside the peak window. | ✓ | |

## Hindi (`hi`)

| tier | rendered advisory | script_ok | reviewer note |
|---|---|---|---|
| good | Delhi Ward 12: अगले 24 घंटों में हवा अच्छी रहने का अनुमान है. हवा ठीक है — सामान्य बाहरी गतिविधि सुरक्षित है. | ✓ | |
| satisfactory | Delhi Ward 12: अगले 24 घंटों में हवा संतोषजनक रहने का अनुमान है. हवा ठीक है — सामान्य बाहरी गतिविधि सुरक्षित है. | ✓ | |
| moderate | Delhi Ward 12: अगले 24 घंटों में हवा मध्यम रहने का अनुमान है. संवेदनशील लोग (बच्चे, बुज़ुर्ग, दमा रोगी) लंबी बाहरी मेहनत कम करें. | ✓ | |
| poor | Delhi Ward 12: अगले 24 घंटों में हवा ख़राब रहने का अनुमान है. बाहर की गतिविधि कम रखें, N95 मास्क पहनें, और भारी काम पीक समय के बाद करें. | ✓ | |
| very_poor | Delhi Ward 12: अगले 24 घंटों में हवा बहुत ख़राब रहने का अनुमान है. बाहर की गतिविधि कम रखें, N95 मास्क पहनें, और भारी काम पीक समय के बाद करें. | ✓ | |
| severe | Delhi Ward 12: अगले 24 घंटों में हवा गंभीर रहने का अनुमान है. बाहर की गतिविधि कम रखें, N95 मास्क पहनें, और भारी काम पीक समय के बाद करें. | ✓ | |

## Kannada (`kn`)

| tier | rendered advisory | script_ok | reviewer note |
|---|---|---|---|
| good | Delhi Ward 12: ಮುಂದಿನ 24 ಗಂಟೆಗಳಲ್ಲಿ ಗಾಳಿಯ ಗುಣಮಟ್ಟ ಉತ್ತಮ ಇರಲಿದೆ ಎಂದು ಅಂದಾಜಿಸಲಾಗಿದೆ. ಗಾಳಿ ಚೆನ್ನಾಗಿದೆ — ಸಾಮಾನ್ಯ ಹೊರಾಂಗಣ ಚಟುವಟಿಕೆ ಸುರಕ್ಷಿತ. | ✓ | |
| satisfactory | Delhi Ward 12: ಮುಂದಿನ 24 ಗಂಟೆಗಳಲ್ಲಿ ಗಾಳಿಯ ಗುಣಮಟ್ಟ ತೃಪ್ತಿಕರ ಇರಲಿದೆ ಎಂದು ಅಂದಾಜಿಸಲಾಗಿದೆ. ಗಾಳಿ ಚೆನ್ನಾಗಿದೆ — ಸಾಮಾನ್ಯ ಹೊರಾಂಗಣ ಚಟುವಟಿಕೆ ಸುರಕ್ಷಿತ. | ✓ | |
| moderate | Delhi Ward 12: ಮುಂದಿನ 24 ಗಂಟೆಗಳಲ್ಲಿ ಗಾಳಿಯ ಗುಣಮಟ್ಟ ಮಧ್ಯಮ ಇರಲಿದೆ ಎಂದು ಅಂದಾಜಿಸಲಾಗಿದೆ. ಸೂಕ್ಷ್ಮ ವ್ಯಕ್ತಿಗಳು (ಮಕ್ಕಳು, ವೃದ್ಧರು, ಅಸ್ತಮಾ ರೋಗಿಗಳು) ದೀರ್ಘ ಹೊರಾಂಗಣ ಶ್ರಮವನ್ನು ಕಡಿಮೆ ಮಾಡಿ. | ✓ | |
| poor | Delhi Ward 12: ಮುಂದಿನ 24 ಗಂಟೆಗಳಲ್ಲಿ ಗಾಳಿಯ ಗುಣಮಟ್ಟ ಕಳಪೆ ಇರಲಿದೆ ಎಂದು ಅಂದಾಜಿಸಲಾಗಿದೆ. ಹೊರಗಿನ ಚಟುವಟಿಕೆ ಕಡಿಮೆ ಮಾಡಿ, N95 ಮಾಸ್ಕ್ ಬಳಸಿ, ಮತ್ತು ಭಾರೀ ಕೆಲಸವನ್ನು ಪೀಕ್ ಸಮಯದ ನಂತರ ಮಾಡಿ. | ✓ | |
| very_poor | Delhi Ward 12: ಮುಂದಿನ 24 ಗಂಟೆಗಳಲ್ಲಿ ಗಾಳಿಯ ಗುಣಮಟ್ಟ ತುಂಬಾ ಕಳಪೆ ಇರಲಿದೆ ಎಂದು ಅಂದಾಜಿಸಲಾಗಿದೆ. ಹೊರಗಿನ ಚಟುವಟಿಕೆ ಕಡಿಮೆ ಮಾಡಿ, N95 ಮಾಸ್ಕ್ ಬಳಸಿ, ಮತ್ತು ಭಾರೀ ಕೆಲಸವನ್ನು ಪೀಕ್ ಸಮಯದ ನಂತರ ಮಾಡಿ. | ✓ | |
| severe | Delhi Ward 12: ಮುಂದಿನ 24 ಗಂಟೆಗಳಲ್ಲಿ ಗಾಳಿಯ ಗುಣಮಟ್ಟ ತೀವ್ರ ಇರಲಿದೆ ಎಂದು ಅಂದಾಜಿಸಲಾಗಿದೆ. ಹೊರಗಿನ ಚಟುವಟಿಕೆ ಕಡಿಮೆ ಮಾಡಿ, N95 ಮಾಸ್ಕ್ ಬಳಸಿ, ಮತ್ತು ಭಾರೀ ಕೆಲಸವನ್ನು ಪೀಕ್ ಸಮಯದ ನಂತರ ಮಾಡಿ. | ✓ | |

## Marathi (`mr`)

| tier | rendered advisory | script_ok | reviewer note |
|---|---|---|---|
| good | Delhi Ward 12: पुढील 24 तासांत हवा चांगली राहण्याचा अंदाज आहे. हवा चांगली आहे — नेहमीची बाहेरील हालचाल सुरक्षित आहे. | ✓ | |
| satisfactory | Delhi Ward 12: पुढील 24 तासांत हवा समाधानकारक राहण्याचा अंदाज आहे. हवा चांगली आहे — नेहमीची बाहेरील हालचाल सुरक्षित आहे. | ✓ | |
| moderate | Delhi Ward 12: पुढील 24 तासांत हवा मध्यम राहण्याचा अंदाज आहे. संवेदनशील व्यक्तींनी (लहान मुले, वृद्ध, दमा) दीर्घ बाहेरील श्रम कमी करावेत. | ✓ | |
| poor | Delhi Ward 12: पुढील 24 तासांत हवा खराब राहण्याचा अंदाज आहे. बाहेरील हालचाल कमी ठेवा, N95 मास्क वापरा, आणि जड काम पीक वेळेनंतर करा. | ✓ | |
| very_poor | Delhi Ward 12: पुढील 24 तासांत हवा खूप खराब राहण्याचा अंदाज आहे. बाहेरील हालचाल कमी ठेवा, N95 मास्क वापरा, आणि जड काम पीक वेळेनंतर करा. | ✓ | |
| severe | Delhi Ward 12: पुढील 24 तासांत हवा गंभीर राहण्याचा अंदाज आहे. बाहेरील हालचाल कमी ठेवा, N95 मास्क वापरा, आणि जड काम पीक वेळेनंतर करा. | ✓ | |

## Tamil (`ta`)

| tier | rendered advisory | script_ok | reviewer note |
|---|---|---|---|
| good | Delhi Ward 12: அடுத்த 24 மணி நேரத்தில் காற்றின் தரம் நல்லது இருக்கும் என எதிர்பார்க்கப்படுகிறது. காற்று நன்றாக உள்ளது — வழக்கமான வெளிப்புற செயல்பாடு பாதுகாப்பானது. | ✓ | |
| satisfactory | Delhi Ward 12: அடுத்த 24 மணி நேரத்தில் காற்றின் தரம் திருப்திகரம் இருக்கும் என எதிர்பார்க்கப்படுகிறது. காற்று நன்றாக உள்ளது — வழக்கமான வெளிப்புற செயல்பாடு பாதுகாப்பானது. | ✓ | |
| moderate | Delhi Ward 12: அடுத்த 24 மணி நேரத்தில் காற்றின் தரம் மிதமான இருக்கும் என எதிர்பார்க்கப்படுகிறது. உணர்திறன் உள்ளவர்கள் (குழந்தைகள், முதியோர், ஆஸ்துமா) நீண்ட வெளிப்புற உழைப்பைக் குறைக்கவும். | ✓ | |
| poor | Delhi Ward 12: அடுத்த 24 மணி நேரத்தில் காற்றின் தரம் மோசம் இருக்கும் என எதிர்பார்க்கப்படுகிறது. வெளியில் செல்வதைக் குறைக்கவும், N95 முகக்கவசம் அணியவும், கடின வேலைகளை உச்ச நேரத்திற்குப் பிறகு செய்யவும். | ✓ | |
| very_poor | Delhi Ward 12: அடுத்த 24 மணி நேரத்தில் காற்றின் தரம் மிக மோசம் இருக்கும் என எதிர்பார்க்கப்படுகிறது. வெளியில் செல்வதைக் குறைக்கவும், N95 முகக்கவசம் அணியவும், கடின வேலைகளை உச்ச நேரத்திற்குப் பிறகு செய்யவும். | ✓ | |
| severe | Delhi Ward 12: அடுத்த 24 மணி நேரத்தில் காற்றின் தரம் தீவிரம் இருக்கும் என எதிர்பார்க்கப்படுகிறது. வெளியில் செல்வதைக் குறைக்கவும், N95 முகக்கவசம் அணியவும், கடின வேலைகளை உச்ச நேரத்திற்குப் பிறகு செய்யவும். | ✓ | |

## Telugu (`te`)

| tier | rendered advisory | script_ok | reviewer note |
|---|---|---|---|
| good | Delhi Ward 12: రాబోయే 24 గంటల్లో గాలి నాణ్యత మంచిదిగా ఉండవచ్చు. గాలి బాగుంది — సాధారణ బయటి కార్యకలాపాలు సురక్షితం. | ✓ | |
| satisfactory | Delhi Ward 12: రాబోయే 24 గంటల్లో గాలి నాణ్యత సంతృప్తికరంగా ఉండవచ్చు. గాలి బాగుంది — సాధారణ బయటి కార్యకలాపాలు సురక్షితం. | ✓ | |
| moderate | Delhi Ward 12: రాబోయే 24 గంటల్లో గాలి నాణ్యత మధ్యస్థంగా ఉండవచ్చు. సున్నితమైన వారు (పిల్లలు, వృద్ధులు, ఆస్తమా) ఎక్కువసేపు బయటి శ్రమను తగ్గించండి. | ✓ | |
| poor | Delhi Ward 12: రాబోయే 24 గంటల్లో గాలి నాణ్యత చెడ్డదిగా ఉండవచ్చు. బయటి కార్యకలాపాలు తగ్గించండి, N95 మాస్క్ ధరించండి, భారీ పనిని పీక్ సమయం తర్వాత చేయండి. | ✓ | |
| very_poor | Delhi Ward 12: రాబోయే 24 గంటల్లో గాలి నాణ్యత చాలా చెడ్డదిగా ఉండవచ్చు. బయటి కార్యకలాపాలు తగ్గించండి, N95 మాస్క్ ధరించండి, భారీ పనిని పీక్ సమయం తర్వాత చేయండి. | ✓ | |
| severe | Delhi Ward 12: రాబోయే 24 గంటల్లో గాలి నాణ్యత తీవ్రంగా ఉండవచ్చు. బయటి కార్యకలాపాలు తగ్గించండి, N95 మాస్క్ ధరించండి, భారీ పనిని పీక్ సమయం తర్వాత చేయండి. | ✓ | |

## Bengali (`bn`)

| tier | rendered advisory | script_ok | reviewer note |
|---|---|---|---|
| good | Delhi Ward 12: আগামী 24 ঘণ্টায় বাতাস ভালো থাকার পূর্বাভাস। বাতাস ভালো — স্বাভাবিক বাইরের কাজ নিরাপদ। | ✓ | |
| satisfactory | Delhi Ward 12: আগামী 24 ঘণ্টায় বাতাস সন্তোষজনক থাকার পূর্বাভাস। বাতাস ভালো — স্বাভাবিক বাইরের কাজ নিরাপদ। | ✓ | |
| moderate | Delhi Ward 12: আগামী 24 ঘণ্টায় বাতাস মাঝারি থাকার পূর্বাভাস। সংবেদনশীল ব্যক্তিরা (শিশু, বয়স্ক, হাঁপানি) দীর্ঘ বাইরের পরিশ্রম কমান। | ✓ | |
| poor | Delhi Ward 12: আগামী 24 ঘণ্টায় বাতাস খারাপ থাকার পূর্বাভাস। বাইরে কম সময় থাকুন, N95 মাস্ক পরুন এবং ভারী কাজ পিক সময়ের পরে করুন। | ✓ | |
| very_poor | Delhi Ward 12: আগামী 24 ঘণ্টায় বাতাস খুব খারাপ থাকার পূর্বাভাস। বাইরে কম সময় থাকুন, N95 মাস্ক পরুন এবং ভারী কাজ পিক সময়ের পরে করুন। | ✓ | |
| severe | Delhi Ward 12: আগামী 24 ঘণ্টায় বাতাস গুরুতর থাকার পূর্বাভাস। বাইরে কম সময় থাকুন, N95 মাস্ক পরুন এবং ভারী কাজ পিক সময়ের পরে করুন। | ✓ | |

## Gujarati (`gu`)

| tier | rendered advisory | script_ok | reviewer note |
|---|---|---|---|
| good | Delhi Ward 12: આગામી 24 કલાકમાં હવા સારી રહેવાની આગાહી છે. હવા સારી છે — સામાન્ય બહારની પ્રવૃત્તિ સલામત છે. | ✓ | |
| satisfactory | Delhi Ward 12: આગામી 24 કલાકમાં હવા સંતોષકારક રહેવાની આગાહી છે. હવા સારી છે — સામાન્ય બહારની પ્રવૃત્તિ સલામત છે. | ✓ | |
| moderate | Delhi Ward 12: આગામી 24 કલાકમાં હવા મધ્યમ રહેવાની આગાહી છે. સંવેદનશીલ લોકો (બાળકો, વૃદ્ધો, દમના દર્દીઓ) લાંબો બહારનો શ્રમ ઓછો કરો. | ✓ | |
| poor | Delhi Ward 12: આગામી 24 કલાકમાં હવા ખરાબ રહેવાની આગાહી છે. બહારની પ્રવૃત્તિ ઓછી રાખો, N95 માસ્ક પહેરો અને ભારે કામ પીક સમય પછી કરો. | ✓ | |
| very_poor | Delhi Ward 12: આગામી 24 કલાકમાં હવા ખૂબ ખરાબ રહેવાની આગાહી છે. બહારની પ્રવૃત્તિ ઓછી રાખો, N95 માસ્ક પહેરો અને ભારે કામ પીક સમય પછી કરો. | ✓ | |
| severe | Delhi Ward 12: આગામી 24 કલાકમાં હવા ગંભીર રહેવાની આગાહી છે. બહારની પ્રવૃત્તિ ઓછી રાખો, N95 માસ્ક પહેરો અને ભારે કામ પીક સમય પછી કરો. | ✓ | |

## How to sign off

1. Read the six rows for your language aloud; check tier words (good → severe) are the everyday words a
   municipal notice would use, and the advice for *poor / very poor / severe* is the standard mask /
   limit-outdoor-exertion guidance.
2. Write corrections in the note column, or edit `LANG_LABEL[<lang>]` in `agents/advisory.py` directly
   (tests in `tests/test_advisory_script_check.py` re-check the script).
3. Flip the status row to `reviewed by a native speaker (role, e.g. team member / public-health nurse)`
   with the date. Do not mark a language reviewed that nobody has read.
