/**
 * Curated Collection of English & Hindi Novels, Storybooks, Children's Stories, and Classic Literature
 * Covers all required categories with verified authors, authentic ISBNs, and Open Library cover URLs.
 */

const CURATED_BOOKS = [
    // -------------------------------------------------------------
    // ENGLISH NOVELS & STORIES (18 Books)
    // -------------------------------------------------------------
    {
        title: "Harry Potter and the Philosopher's Stone",
        author: "J.K. Rowling",
        category: "Fantasy & Adventure",
        language: "English",
        isbn: "978-0747532699",
        shelf: "Fantasy F-101",
        publication_year: 1997,
        cover_image: "https://covers.openlibrary.org/b/isbn/9780747532699-M.jpg",
        description: "The magical journey of an orphaned boy who discovers on his eleventh birthday that he is a wizard, embarking on an extraordinary adventure at Hogwarts School of Witchcraft and Wizardry.",
        status: "available"
    },
    {
        title: "The Alchemist",
        author: "Paulo Coelho",
        category: "Classic Literature",
        language: "English",
        isbn: "978-0062315007",
        shelf: "Classics C-102",
        publication_year: 1988,
        cover_image: "https://covers.openlibrary.org/b/isbn/9780062315007-M.jpg",
        description: "An inspiring allegorical novel following Santiago, an Andalusian shepherd boy who yearns to travel in search of a worldly treasure, discovering profound universal truths along his pilgrimage.",
        status: "available"
    },
    {
        title: "The Jungle Book",
        author: "Rudyard Kipling",
        category: "Children's Stories",
        language: "English",
        isbn: "978-0141325293",
        shelf: "Children K-105",
        publication_year: 1894,
        cover_image: "https://covers.openlibrary.org/b/isbn/9780141325293-M.jpg",
        description: "The timeless adventures of Mowgli, a boy raised by wolves in the Seoni jungle of Madhya Pradesh, mentored by Baloo the bear and Bagheera the panther while confronting Shere Khan.",
        status: "available"
    },
    {
        title: "Alice's Adventures in Wonderland",
        author: "Lewis Carroll",
        category: "Fantasy & Adventure",
        language: "English",
        isbn: "978-0486275437",
        shelf: "Fantasy F-104",
        publication_year: 1865,
        cover_image: "https://covers.openlibrary.org/b/isbn/9780486275437-M.jpg",
        description: "A whimsical, fantastical tale of young Alice tumbling down a rabbit hole into a surreal underground realm inhabited by eccentric creatures like the Cheshire Cat and the Queen of Hearts.",
        status: "available"
    },
    {
        title: "The Little Prince",
        author: "Antoine de Saint-Exupéry",
        category: "Moral Stories",
        language: "English",
        isbn: "978-0156012195",
        shelf: "Moral M-201",
        publication_year: 1943,
        cover_image: "https://covers.openlibrary.org/b/isbn/9780156012195-M.jpg",
        description: "A tender, poetic tale recounting an aviator stranded in the Sahara Desert meeting an enigmatic little prince from an asteroid, exploring themes of friendship, love, and what is truly essential to the heart.",
        status: "available"
    },
    {
        title: "Sherlock Holmes: The Hound of the Baskervilles",
        author: "Arthur Conan Doyle",
        category: "Mystery & Thriller",
        language: "English",
        isbn: "978-0140437867",
        shelf: "Mystery M-301",
        publication_year: 1902,
        cover_image: "https://covers.openlibrary.org/b/isbn/9780140437867-M.jpg",
        description: "The world's greatest consulting detective, Sherlock Holmes, and Dr. John Watson investigate the spectral hound terrorizing the aristocratic Baskerville lineage across the fog-shrouded Dartmoor moors.",
        status: "available"
    },
    {
        title: "Pride and Prejudice",
        author: "Jane Austen",
        category: "Romance",
        language: "English",
        isbn: "978-0141439518",
        shelf: "Romance R-401",
        publication_year: 1813,
        cover_image: "https://covers.openlibrary.org/b/isbn/9780141439518-M.jpg",
        description: "The sparkling romantic comedy of manners depicting the witty Elizabeth Bennet and the aloof Mr. Darcy as they overcome pride, class prejudice, and societal misjudgments.",
        status: "available"
    },
    {
        title: "The Adventures of Tom Sawyer",
        author: "Mark Twain",
        category: "English Novels",
        language: "English",
        isbn: "978-0143039563",
        shelf: "Novels N-501",
        publication_year: 1876,
        cover_image: "https://covers.openlibrary.org/b/isbn/9780143039563-M.jpg",
        description: "The mischievous and spirited escapades of Tom Sawyer and his companion Huckleberry Finn along the Mississippi River in the fictional town of St. Petersburg, Missouri.",
        status: "available"
    },
    {
        title: "The Secret Garden",
        author: "Frances Hodgson Burnett",
        category: "English Storybooks",
        language: "English",
        isbn: "978-0141321066",
        shelf: "Storybooks S-601",
        publication_year: 1911,
        cover_image: "https://covers.openlibrary.org/b/isbn/9780141321066-M.jpg",
        description: "Orphaned Mary Lennox is sent to her reclusive uncle's gloomy manor in Yorkshire, where discovering a locked, neglected garden transforms her spirit and brings healing to her fragile cousin Colin.",
        status: "available"
    },
    {
        title: "Aesop's Fables",
        author: "Aesop",
        category: "Moral Stories",
        language: "English",
        isbn: "978-0140449495",
        shelf: "Moral M-202",
        publication_year: 1954,
        cover_image: "https://covers.openlibrary.org/b/isbn/9780140449495-M.jpg",
        description: "A celebrated treasury of ancient fables featuring the Tortoise and the Hare, the Boy Who Cried Wolf, and the Fox and the Grapes, delivering timeless moral guidance and practical wisdom.",
        status: "available"
    },
    {
        title: "The Hobbit",
        author: "J.R.R. Tolkien",
        category: "Fantasy & Adventure",
        language: "English",
        isbn: "978-0547928227",
        shelf: "Fantasy F-102",
        publication_year: 1937,
        cover_image: "https://covers.openlibrary.org/b/isbn/9780547928227-M.jpg",
        description: "Bilbo Baggins, a peace-loving hobbit, is whisked away on an unforgettable quest with Gandalf and thirteen dwarves to reclaim the Lonely Mountain from the fearsome dragon Smaug.",
        status: "available"
    },
    {
        title: "1984",
        author: "George Orwell",
        category: "Classic Literature",
        language: "English",
        isbn: "978-0451524935",
        shelf: "Classics C-103",
        publication_year: 1949,
        cover_image: "https://covers.openlibrary.org/b/isbn/9780451524935-M.jpg",
        description: "A haunting dystopian classic chronicling Winston Smith's rebellion against totalitarian state surveillance, Big Brother, and the terrifying manipulation of historical truth.",
        status: "available"
    },
    {
        title: "To Kill a Mockingbird",
        author: "Harper Lee",
        category: "English Novels",
        language: "English",
        isbn: "978-0060935467",
        shelf: "Novels N-502",
        publication_year: 1960,
        cover_image: "https://covers.openlibrary.org/b/isbn/9780060935467-M.jpg",
        description: "Set in Maycomb, Alabama, lawyer Atticus Finch defends a falsely accused Black man, while his daughter Scout learns about moral courage, empathy, and the cruelty of prejudice.",
        status: "available"
    },
    {
        title: "The Great Gatsby",
        author: "F. Scott Fitzgerald",
        category: "Classic Literature",
        language: "English",
        isbn: "978-0743273565",
        shelf: "Classics C-104",
        publication_year: 1925,
        cover_image: "https://covers.openlibrary.org/b/isbn/9780743273565-M.jpg",
        description: "An evocative critique of the Jazz Age and the disillusioned American Dream, chronicling mysterious millionaire Jay Gatsby and his unquenchable obsession with Daisy Buchanan.",
        status: "available"
    },
    {
        title: "Frankenstein",
        author: "Mary Shelley",
        category: "Mystery & Thriller",
        language: "English",
        isbn: "978-0141439471",
        shelf: "Mystery M-302",
        publication_year: 1818,
        cover_image: "https://covers.openlibrary.org/b/isbn/9780141439471-M.jpg",
        description: "A foundational Gothic masterpiece investigating science, hubris, and alienation as ambitious scientist Victor Frankenstein animates a living monster who turns against his creator.",
        status: "available"
    },
    {
        title: "Treasure Island",
        author: "Robert Louis Stevenson",
        category: "Fantasy & Adventure",
        language: "English",
        isbn: "978-0141321004",
        shelf: "Fantasy F-103",
        publication_year: 1883,
        cover_image: "https://covers.openlibrary.org/b/isbn/9780141321004-M.jpg",
        description: "The quintessential pirate saga following Jim Hawkins after finding a map to Captain Flint's buried gold, sailing on the Hispaniola under the watchful eye of rogue Long John Silver.",
        status: "available"
    },
    {
        title: "Wuthering Heights",
        author: "Emily Brontë",
        category: "Romance",
        language: "English",
        isbn: "978-0141439556",
        shelf: "Romance R-402",
        publication_year: 1847,
        cover_image: "https://covers.openlibrary.org/b/isbn/9780141439556-M.jpg",
        description: "A dark and tempestuous Gothic romance depicting the fierce, unforgiving bond between foundling Heathcliff and high-spirited Catherine Earnshaw across the untamed Yorkshire moors.",
        status: "available"
    },
    {
        title: "The Wind in the Willows",
        author: "Kenneth Grahame",
        category: "Children's Stories",
        language: "English",
        isbn: "978-0143039099",
        shelf: "Children K-106",
        publication_year: 1908,
        cover_image: "https://covers.openlibrary.org/b/isbn/9780143039099-M.jpg",
        description: "The beloved pastoral adventures of Mole, Ratty, and Badger as they attempt to reform the exuberant, motorcar-crazed Mr. Toad of Toad Hall along the gentle English riverbanks.",
        status: "available"
    },

    // -------------------------------------------------------------
    // HINDI NOVELS & STORIES (18 Books)
    // -------------------------------------------------------------
    {
        title: "Godaan (गोदान)",
        author: "Munshi Premchand",
        category: "Hindi Novels",
        language: "Hindi",
        isbn: "978-8170280019",
        shelf: "Hindi Sahitya H-101",
        publication_year: 1936,
        cover_image: "https://covers.openlibrary.org/b/isbn/9788170280019-M.jpg",
        description: "मुंशी प्रेमचंद का कालजयी उपन्यास जो भारतीय ग्रामीण समाज में किसान होरी के संघर्ष, अभाव, कर्ज और एक गाय रखने की अधूरी लालसा का मार्मिक और यथार्थवादी चित्रण करता है।",
        status: "available"
    },
    {
        title: "Nirmala (निर्मला)",
        author: "Munshi Premchand",
        category: "Hindi Novels",
        language: "Hindi",
        isbn: "978-8170280149",
        shelf: "Hindi Sahitya H-102",
        publication_year: 1927,
        cover_image: "https://covers.openlibrary.org/b/isbn/9788170280149-M.jpg",
        description: "दहेज प्रथा और अनमेल विवाह की त्रासदी पर आधारित एक हृदयस्पर्शी सामाजिक उपन्यास, जिसमें युवा निर्मला के बलिदान, पारिवारिक कलह और नारी की विवशता को संवेदनशीलता से उभारा गया है।",
        status: "available"
    },
    {
        title: "Gaban (ग़बन)",
        author: "Munshi Premchand",
        category: "Hindi Novels",
        language: "Hindi",
        isbn: "978-8170280101",
        shelf: "Hindi Sahitya H-103",
        publication_year: 1931,
        cover_image: "https://covers.openlibrary.org/b/isbn/9788170280101-M.jpg",
        description: "आभूषण-प्रियता और झूठी सामाजिक प्रतिष्ठा के फेर में फंसे युवक रमानाथ के पतन, ग़बन और अंततः आत्म-सुधार की रोमांचक कथा जो मानवीय दुर्बलताओं का गहरा विश्लेषण करती है।",
        status: "available"
    },
    {
        title: "Mansarovar: Katha Sangrah (मानसरोवर)",
        author: "Munshi Premchand",
        category: "Hindi Storybooks",
        language: "Hindi",
        isbn: "978-8170281245",
        shelf: "Hindi Katha H-201",
        publication_year: 1936,
        cover_image: "https://covers.openlibrary.org/b/isbn/9788170281245-M.jpg",
        description: "प्रेमचंद की सर्वश्रेष्ठ कहानियों का संग्रह जिसमें 'कफ़न', 'नमक का दारोगा', 'पूस की रात' और 'शतरंज के खिलाड़ी' जैसी अमर कृतियाँ सामाजिक यथार्थ का सजीव आईना दिखाती हैं।",
        status: "available"
    },
    {
        title: "Gunahon Ka Devta (गुनाहों का देवता)",
        author: "Dharamvir Bharati",
        category: "Romance",
        language: "Hindi",
        isbn: "978-8126700448",
        shelf: "Hindi Sahitya H-104",
        publication_year: 1949,
        cover_image: "https://covers.openlibrary.org/b/isbn/9788126700448-M.jpg",
        description: "इलाहाबाद के परिवेश में रची गई चंदर और सुधा की अलौकिक, पवित्र किंतु विरह-दग्ध प्रेम कथा, जिसने दशकों से हिंदी साहित्य के पाठकों के दिलों को गहराई से छुआ है।",
        status: "available"
    },
    {
        title: "Raag Darbari (राग दरबारी)",
        author: "Shrilal Shukla",
        category: "Hindi Novels",
        language: "Hindi",
        isbn: "978-8126704620",
        shelf: "Hindi Sahitya H-105",
        publication_year: 1968,
        cover_image: "https://covers.openlibrary.org/b/isbn/9788126704620-M.jpg",
        description: "साहित्य अकादेमी पुरस्कार से सम्मानित प्रसिद्ध व्यंग्य उपन्यास, जो शिवपालगंज गाँव के माध्यम से स्वतंत्रता के बाद की भारतीय राजनीति, प्रशासनिक ढकोसले और शिक्षा तंत्र की पोल खोलता है।",
        status: "available"
    },
    {
        title: "Chandrakanta (चंद्रकांता)",
        author: "Devaki Nandan Khatri",
        category: "Fantasy & Adventure",
        language: "Hindi",
        isbn: "978-8126715695",
        shelf: "Hindi Tilism H-301",
        publication_year: 1888,
        cover_image: "https://covers.openlibrary.org/b/isbn/9788126715695-M.jpg",
        description: "हिंदी का पहला तिलिस्मी-ऐयारी उपन्यास! नौगढ़ के राजकुमार वीरेंद्र सिंह और विजयगढ़ की राजकुमारी चंद्रकांता के प्रेम, तिलिस्मी सुरंगों और ऐयारों की जादुई चालों की अद्भुत गाथा।",
        status: "available"
    },
    {
        title: "Panchatantra Ki Kahaniyan (पंचतंत्र की कहानियाँ)",
        author: "Vishnu Sharma",
        category: "Moral Stories",
        language: "Hindi",
        isbn: "978-8171822836",
        shelf: "Hindi Bal H-401",
        publication_year: 1995,
        cover_image: "https://covers.openlibrary.org/b/isbn/9788171822836-M.jpg",
        description: "पशु-पक्षियों के रोचक प्रसंगों के माध्यम से मित्रभेद, मित्रलाभ, काकोलूकीयम आदि पाँच तंत्रों द्वारा जीवन जीने की नीति, कूटनीति और व्यावहारिक ज्ञान सिखाने वाला अमर ग्रंथ।",
        status: "available"
    },
    {
        title: "Akbar-Birbal Ki Kahaniyan (अकबर-बीरबल की कहानियाँ)",
        author: "Traditional / Folk",
        category: "Moral Stories",
        language: "Hindi",
        isbn: "978-8171820474",
        shelf: "Hindi Bal H-402",
        publication_year: 2002,
        cover_image: "https://covers.openlibrary.org/b/isbn/9788171820474-M.jpg",
        description: "मुगल बादशाह अकबर के नवरत्नों में प्रमुख बीरबल की तीक्ष्ण बुद्धि, हाजिरजवाबी, न्यायप्रियता और ज्ञानवर्धक चुटकुलों से सजी मनोरंजक एवं शिक्षाप्रद कहानियों का संकलन।",
        status: "available"
    },
    {
        title: "Tenali Raman Ki Kahaniyan (तेनालीराम की कहानियाँ)",
        author: "Traditional / Folk",
        category: "Children's Stories",
        language: "Hindi",
        isbn: "978-8171827442",
        shelf: "Hindi Bal H-403",
        publication_year: 2005,
        cover_image: "https://covers.openlibrary.org/b/isbn/9788171827442-M.jpg",
        description: "विजयनगर साम्राज्य के महाराज कृष्णदेवराय के प्रिय विदूषक और कवि तेनालीराम की विलक्षण चतुराई, समस्या-समाधान और लोक-कथाओं का हास्य-विनोद से भरपूर संग्रह।",
        status: "available"
    },
    {
        title: "Madhushala (मधुशाला)",
        author: "Harivansh Rai Bachchan",
        category: "Classic Literature",
        language: "Hindi",
        isbn: "978-8170280521",
        shelf: "Hindi Kavya H-501",
        publication_year: 1935,
        cover_image: "https://covers.openlibrary.org/b/isbn/9788170280521-M.jpg",
        description: "हाला, प्याला, मधुबाला और मधुशाला के रूपकों द्वारा जीवन, समाज, धर्म और दर्शन के गूढ़ रहस्यों को सुलझाने वाली छायावादोत्तर हिंदी कविता की एक अद्वितीय और अमर रचना।",
        status: "available"
    },
    {
        title: "Tamas (तमस)",
        author: "Bhisham Sahni",
        category: "Hindi Novels",
        language: "Hindi",
        isbn: "978-8126702954",
        shelf: "Hindi Sahitya H-106",
        publication_year: 1974,
        cover_image: "https://covers.openlibrary.org/b/isbn/9788126702954-M.jpg",
        description: "1947 के भारत विभाजन के दौर में फैली सांप्रदायिक नफ़रत, राजनीतिक चालबाजी और सामान्य जनजीवन पर हुए क्रूर आघातों का बेबाक, मर्मांतक और विचारोत्तेजक दस्तावेज।",
        status: "available"
    },
    {
        title: "Maila Anchal (मैला आँचल)",
        author: "Phanishwar Nath 'Renu'",
        category: "Hindi Novels",
        language: "Hindi",
        isbn: "978-8126704941",
        shelf: "Hindi Sahitya H-107",
        publication_year: 1954,
        cover_image: "https://covers.openlibrary.org/b/isbn/9788126704941-M.jpg",
        description: "बिहार के पूर्णिया अंचल के मेरीगंज गाँव की सामाजिक, राजनीतिक व सांस्कृतिक धड़कनों को लोकभाषा, गीतों और ग्रामीण यथार्थ के संग सजीव करने वाला हिंदी का शीर्ष आंचलिक उपन्यास।",
        status: "available"
    },
    {
        title: "Chitralekha (चित्रलेखा)",
        author: "Bhagwati Charan Verma",
        category: "Classic Literature",
        language: "Hindi",
        isbn: "978-8126700776",
        shelf: "Hindi Sahitya H-108",
        publication_year: 1934,
        cover_image: "https://covers.openlibrary.org/b/isbn/9788126700776-M.jpg",
        description: "मौर्यकालीन पृष्ठभूमि में पाप और पुण्य, भोग और त्याग के दार्शनिक द्वंद्व को प्रस्तुत करता एक कालजयी उपन्यास, जहाँ नर्तकी चित्रलेखा, सामंत बीजगुप्त और योगी कुमारगिरि के माध्यम से जीवन के सत्य की खोज होती है।",
        status: "available"
    },
    {
        title: "Vikram Aur Betal Ki Kahaniyan (विक्रम और बेताल)",
        author: "Traditional / Folk",
        category: "Fantasy & Adventure",
        language: "Hindi",
        isbn: "978-8171821013",
        shelf: "Hindi Bal H-404",
        publication_year: 2001,
        cover_image: "https://covers.openlibrary.org/b/isbn/9788171821013-M.jpg",
        description: "उज्जैन के न्यायप्रिय राजा विक्रमादित्य और चतुर प्रेत बेताल के बीच के पच्चीस गूढ़ पहेलीनुमा संवाद, जो न्याय, विवेक और सही निर्णय लेने की कला सिखाते हैं।",
        status: "available"
    },
    {
        title: "Idgah Aur Anya Kahaniyan (ईदगाह और अन्य श्रेष्ठ कहानियाँ)",
        author: "Munshi Premchand",
        category: "Children's Stories",
        language: "Hindi",
        isbn: "978-8170284796",
        shelf: "Hindi Bal H-405",
        publication_year: 1933,
        cover_image: "https://covers.openlibrary.org/b/isbn/9788170284796-M.jpg",
        description: "नन्हे हामिद और उसकी दादी अमीना के प्रति प्रेम व समझदारी की मार्मिक कहानी 'ईदगाह' के साथ-साथ बच्चों व किशोरों के लिए प्रेमचंद की सर्वश्रेष्ठ नैतिक कहानियों का संकलन।",
        status: "available"
    },
    {
        title: "Hitopadesh Ki Kahaniyan (हितोपदेश की कहानियाँ)",
        author: "Narayana Pandit",
        category: "Moral Stories",
        language: "Hindi",
        isbn: "978-8171822843",
        shelf: "Hindi Bal H-406",
        publication_year: 2004,
        cover_image: "https://covers.openlibrary.org/b/isbn/9788171822843-M.jpg",
        description: "संस्कृत साहित्य का विख्यात नीति-ग्रंथ, जिसमें मित्रलाभ, सुहृद्भेद, विग्रह और संधि जैसे चार भागों में पशु-पक्षियों के संवादों द्वारा व्यावहारिक बुद्धिमत्ता और सद्गुणों की शिक्षा दी गई है।",
        status: "available"
    },
    {
        title: "Sinhasan Battisi (सिंहासन बत्तीसी)",
        author: "Traditional / Folk",
        category: "Fantasy & Adventure",
        language: "Hindi",
        isbn: "978-8171821020",
        shelf: "Hindi Bal H-407",
        publication_year: 2003,
        cover_image: "https://covers.openlibrary.org/b/isbn/9788171821020-M.jpg",
        description: "राजा भोज द्वारा खोजे गए राजा विक्रमादित्य के चमत्कारी सिंहासन पर जड़ी बत्तीस पुतलियों द्वारा सुनाई गई विक्रमादित्य के शौर्य, दानशीलता, दया और उदारता की बत्तीस अमर कथाएं।",
        status: "available"
    }
];

// Tech Book cover mappings for the existing 14 technical books in Library 1
const TECH_BOOK_COVERS = {
    "Clean Architecture: A Craftsman's Guide": {
        cover: "https://covers.openlibrary.org/b/isbn/9780134494166-M.jpg",
        desc: "Universal rules of software structure and architecture from Uncle Bob Martin.",
        lang: "English"
    },
    "Design Patterns: Elements of Reusable Object-Oriented Software": {
        cover: "https://covers.openlibrary.org/b/isbn/9780201633610-M.jpg",
        desc: "The Gang of Four's foundational catalog of reusable object-oriented solutions.",
        lang: "English"
    },
    "Introduction to Algorithms (CLRS)": {
        cover: "https://covers.openlibrary.org/b/isbn/9780262033848-M.jpg",
        desc: "Comprehensive reference on contemporary algorithms and data structures.",
        lang: "English"
    },
    "The Pragmatic Programmer": {
        cover: "https://covers.openlibrary.org/b/isbn/9780135957059-M.jpg",
        desc: "Timeless practices and philosophy for modern software craftsmanship.",
        lang: "English"
    },
    "Artificial Intelligence: A Modern Approach": {
        cover: "https://covers.openlibrary.org/b/isbn/9780136042594-M.jpg",
        desc: "Authoritative exploration of AI principles, search, knowledge, and learning.",
        lang: "English"
    },
    "Database System Concepts": {
        cover: "https://covers.openlibrary.org/b/isbn/9780078022159-M.jpg",
        desc: "Core concepts of database design, relational schemas, SQL, and transactions.",
        lang: "English"
    },
    "Designing Data-Intensive Applications": {
        cover: "https://covers.openlibrary.org/b/isbn/9781449373320-M.jpg",
        desc: "Key principles of reliability, scalability, and maintainability in data systems.",
        lang: "English"
    },
    "Computer Networking: A Top-Down Approach": {
        cover: "https://covers.openlibrary.org/b/isbn/9780133594140-M.jpg",
        desc: "Layer-by-layer exploration of computer networks and internet protocols.",
        lang: "English"
    }
};

module.exports = {
    CURATED_BOOKS,
    TECH_BOOK_COVERS
};
