/**
 * =============================================================================
 * HS LIBRARY — SCHOOL CURRICULUM COLLECTION (NURSERY TO CLASS 12)
 * 20 High-Quality Curated Hindi & English Books for All School Grade Levels
 * =============================================================================
 */

const SCHOOL_K12_BOOKS = [
    // -------------------------------------------------------------
    // 1. NURSERY & PRE-PRIMARY (Ages 3-5)
    // -------------------------------------------------------------
    {
        title: "Nursery Rhymes & Illustrated Fairy Tales",
        author: "Mother Goose",
        category: "Nursery & Pre-Primary",
        language: "English",
        isbn: "978-0141329000",
        shelf: "Primary Section K-01",
        publication_year: 2020,
        cover_image: "https://covers.openlibrary.org/b/isbn/9780141329000-M.jpg",
        description: "Classic rhymes and rhythmic verses including Twinkle Twinkle, Humpty Dumpty, and Baa Baa Black Sheep for nursery learners.",
        status: "available"
    },
    {
        title: "बालगीत एवं सचित्र कहानियाँ (Nursery Balgeet)",
        author: "डॉ. राष्ट्रबंधु (Dr. Rashtrabandhu)",
        category: "Nursery & Pre-Primary",
        language: "Hindi",
        isbn: "978-8123712345",
        shelf: "Primary Section K-02",
        publication_year: 2021,
        cover_image: "https://covers.openlibrary.org/b/isbn/9788123712345-M.jpg",
        description: "नन्हे-मुन्ने बच्चों के लिए चंदा मामा, तितली उड़ी, और नटखट बंदर जैसी मनोरंजक बाल कविताएँ एवं सरल सचित्र कहानियाँ।",
        status: "available"
    },

    // -------------------------------------------------------------
    // 2. PRIMARY SCHOOL (Class 1 to 5, Ages 6-10)
    // -------------------------------------------------------------
    {
        title: "Aesop's Fables for Young Learners (Class 1-2)",
        author: "Aesop",
        category: "Primary School (Class 1-5)",
        language: "English",
        isbn: "978-0141325415",
        shelf: "Primary Section P-101",
        publication_year: 2018,
        cover_image: "https://covers.openlibrary.org/b/isbn/9780141325415-M.jpg",
        description: "Timeless illustrated fables including The Tortoise and the Hare, The Lion and the Mouse, and The Boy Who Cried Wolf.",
        status: "available"
    },
    {
        title: "पंचतंत्र की अमर कहानियाँ (Panchatantra Tales)",
        author: "विष्णु शर्मा (Pt. Vishnu Sharma)",
        category: "Primary School (Class 1-5)",
        language: "Hindi",
        isbn: "978-8171822835",
        shelf: "Primary Section P-102",
        publication_year: 2019,
        cover_image: "https://covers.openlibrary.org/b/isbn/9788171822835-M.jpg",
        description: "बच्चों में बुद्धि, सूझबूझ और नैतिक मूल्यों का विकास करने वाली बंदर और मगरमच्छ, शेर और खरगोश की प्रसिद्ध प्रेरक कथाएँ।",
        status: "available"
    },
    {
        title: "The Magic Drum and Other Favorite Stories",
        author: "Sudha Murty",
        category: "Primary School (Class 1-5)",
        language: "English",
        isbn: "978-0143330349",
        shelf: "Primary Section P-201",
        publication_year: 2006,
        cover_image: "https://covers.openlibrary.org/b/isbn/9780143330349-M.jpg",
        description: "Delightful traditional and moral tales told with wit, kindness and wisdom for middle and primary school readers by Sudha Murty.",
        status: "available"
    },
    {
        title: "अकबर और बीरबल के किस्से (Akbar & Birbal Stories)",
        author: "शशि भूषण (Shashi Bhushan)",
        category: "Primary School (Class 1-5)",
        language: "Hindi",
        isbn: "978-8128801235",
        shelf: "Primary Section P-202",
        publication_year: 2020,
        cover_image: "https://covers.openlibrary.org/b/isbn/9788128801235-M.jpg",
        description: "बादशाह अकबर के दरबार में बीरबल की बुद्धिमानी, हाजिरजवाबी और न्यायप्रियता के प्रसिद्ध मनोरंजक किस्से।",
        status: "available"
    },

    // -------------------------------------------------------------
    // 3. MIDDLE SCHOOL (Class 6 to 8, Ages 11-13)
    // -------------------------------------------------------------
    {
        title: "Malgudi Schooldays: Swami and Friends",
        author: "R.K. Narayan",
        category: "Middle School (Class 6-8)",
        language: "English",
        isbn: "978-8185986005",
        shelf: "Middle Section M-301",
        publication_year: 2000,
        cover_image: "https://covers.openlibrary.org/b/isbn/9788185986005-M.jpg",
        description: "The humorous and heartwarming escapades of ten-year-old Swaminathan and his companions in the fictional town of Malgudi.",
        status: "available"
    },
    {
        title: "वसंत - कक्षा 6 हिंदी पाठ्यपुस्तक (NCERT Vasant Class 6)",
        author: "NCERT Textbook Committee",
        category: "Middle School (Class 6-8)",
        language: "Hindi",
        isbn: "978-8174504937",
        shelf: "Middle Section M-302",
        publication_year: 2022,
        cover_image: "https://covers.openlibrary.org/b/isbn/9788174504937-M.jpg",
        description: "कक्षा 6 के विद्यार्थियों के लिए हिंदी साहित्य का संकलन — कविताएँ, निबंध और रोचक प्रेरक कहानियाँ।",
        status: "available"
    },
    {
        title: "The Adventures of Tom Sawyer (School Edition)",
        author: "Mark Twain",
        category: "Middle School (Class 6-8)",
        language: "English",
        isbn: "978-0141321103",
        shelf: "Middle Section M-303",
        publication_year: 2014,
        cover_image: "https://covers.openlibrary.org/b/isbn/9780141321103-M.jpg",
        description: "Mark Twain's classic novel celebrating boyhood, adventures along the Mississippi River, and youthful daring.",
        status: "available"
    },
    {
        title: "बाल महाभारत कथा (Bal Mahabharat Katha Class 7)",
        author: "चक्रवर्ती राजगोपालाचारी (C. Rajagopalachari)",
        category: "Middle School (Class 6-8)",
        language: "Hindi",
        isbn: "978-8174507006",
        shelf: "Middle Section M-304",
        publication_year: 2021,
        cover_image: "https://covers.openlibrary.org/b/isbn/9788174507006-M.jpg",
        description: "कक्षा 7 के विद्यार्थियों के लिए सरल और सुबोध भाषा में महाभारत के प्रमुख चरित्रों और प्रसंगों का सारगर्भित वर्णन।",
        status: "available"
    },
    {
        title: "Mathematics for Class 8 Foundation",
        author: "R.S. Aggarwal",
        category: "Middle School (Class 6-8)",
        language: "English",
        isbn: "978-9387410084",
        shelf: "Science & Math S-108",
        publication_year: 2023,
        cover_image: "https://covers.openlibrary.org/b/isbn/9789387410084-M.jpg",
        description: "Comprehensive foundation guide for Class 8 Mathematics covering rational numbers, geometry, algebra, and mensuration.",
        status: "available"
    },
    {
        title: "प्रेमचंद की सर्वश्रेष्ठ कहानियाँ (Best Stories of Premchand)",
        author: "मुंशी प्रेमचंद (Munshi Premchand)",
        category: "Middle School (Class 6-8)",
        language: "Hindi",
        isbn: "978-8170280149",
        shelf: "Middle Section M-305",
        publication_year: 2019,
        cover_image: "https://covers.openlibrary.org/b/isbn/9788170280149-M.jpg",
        description: "ईदगाह, नमक का दारोगा, पंच परमेश्वर और दो बैलों की कथा जैसी हिंदी साहित्य की अमर और कालजयी रचनाएँ।",
        status: "available"
    },

    // -------------------------------------------------------------
    // 4. SECONDARY SCHOOL (Class 9 to 10, Ages 14-15)
    // -------------------------------------------------------------
    {
        title: "Science & Technology for Class 9 (CBSE / NCERT)",
        author: "NCERT Expert Panel",
        category: "Secondary School (Class 9-10)",
        language: "English",
        isbn: "978-8174505187",
        shelf: "Science & Math S-109",
        publication_year: 2023,
        cover_image: "https://covers.openlibrary.org/b/isbn/9788174505187-M.jpg",
        description: "Standard Class 9 textbook covering matter in our surroundings, force and laws of motion, gravitation, and cell biology.",
        status: "available"
    },
    {
        title: "स्पर्श भाग 1 - कक्षा 9 हिंदी (Sparsh Class 9)",
        author: "NCERT Textbook Committee",
        category: "Secondary School (Class 9-10)",
        language: "Hindi",
        isbn: "978-8174505293",
        shelf: "Secondary Section S-401",
        publication_year: 2022,
        cover_image: "https://covers.openlibrary.org/b/isbn/9788174505293-M.jpg",
        description: "कक्षा 9 की सीबीएसई हिंदी पाठ्यपुस्तक जिसमें कबीर की साखी, रहीम के दोहे, और आधुनिक लेखकों के गद्य शामिल हैं।",
        status: "available"
    },
    {
        title: "First Flight: English Literature Reader for Class 10",
        author: "CBSE / NCERT Editorial Board",
        category: "Secondary School (Class 9-10)",
        language: "English",
        isbn: "978-8174506580",
        shelf: "Secondary Section S-402",
        publication_year: 2023,
        cover_image: "https://covers.openlibrary.org/b/isbn/9788174506580-M.jpg",
        description: "CBSE Class 10 prose and poetry collection featuring A Letter to God, Nelson Mandela: Long Walk to Freedom, and classic verse.",
        status: "available"
    },
    {
        title: "गणित - कक्षा 10 (NCERT Class 10 Mathematics Hindi Edition)",
        author: "NCERT Editorial Board",
        category: "Secondary School (Class 9-10)",
        language: "Hindi",
        isbn: "978-8174506344",
        shelf: "Science & Math S-110",
        publication_year: 2023,
        cover_image: "https://covers.openlibrary.org/b/isbn/9788174506344-M.jpg",
        description: "कक्षा 10 गणित के सभी अध्याय: वास्तविक संख्याएं, बहुपद, त्रिकोणमिति, द्विघात समीकरण, और सांख्यिकी का संपूर्ण हल।",
        status: "available"
    },

    // -------------------------------------------------------------
    // 5. SENIOR SECONDARY SCHOOL (Class 11 to 12, Ages 16-18)
    // -------------------------------------------------------------
    {
        title: "Concepts of Physics (Volume 1 & 2)",
        author: "Dr. H.C. Verma",
        category: "Senior Secondary (Class 11-12)",
        language: "English",
        isbn: "978-8177091878",
        shelf: "Physics Lab Reference P-112",
        publication_year: 2022,
        cover_image: "https://covers.openlibrary.org/b/isbn/9788177091878-M.jpg",
        description: "The definitive conceptual guide for Class 11 and 12 physics students covering mechanics, thermodynamics, electromagnetism, and optics.",
        status: "available"
    },
    {
        title: "आरोह भाग 2 - कक्षा 12 हिंदी साहित्य (Aaroh Class 12)",
        author: "NCERT Textbook Committee",
        category: "Senior Secondary (Class 11-12)",
        language: "Hindi",
        isbn: "978-8174507341",
        shelf: "Senior Section SR-501",
        publication_year: 2023,
        cover_image: "https://covers.openlibrary.org/b/isbn/9788174507341-M.jpg",
        description: "कक्षा 12 के लिए हिंदी साहित्य का संकलन: हरिवंश राय बच्चन, तुलसीदास, सूर्यकांत त्रिपाठी 'निराला' और महादेवी वर्मा की रचनाएँ।",
        status: "available"
    },
    {
        title: "Contemporary World Politics for Class 12",
        author: "NCERT Expert Committee",
        category: "Senior Secondary (Class 11-12)",
        language: "English",
        isbn: "978-8174507020",
        shelf: "Social Sciences SS-112",
        publication_year: 2023,
        cover_image: "https://covers.openlibrary.org/b/isbn/9788174507020-M.jpg",
        description: "CBSE Class 12 Political Science textbook analyzing the Cold War era, US hegemony, South Asian geopolitics, and globalization.",
        status: "available"
    },
    {
        title: "भौतिकी - कक्षा 12 भाग 1 एवं 2 (Physics in Hindi Class 12)",
        author: "NCERT Editorial Board",
        category: "Senior Secondary (Class 11-12)",
        language: "Hindi",
        isbn: "978-8174507457",
        shelf: "Science & Math S-112",
        publication_year: 2023,
        cover_image: "https://covers.openlibrary.org/b/isbn/9788174507457-M.jpg",
        description: "कक्षा 12 हिंदी माध्यम के विद्यार्थियों के लिए वैद्युत आवेश, चुंबकत्व, तरंग प्रकाशिकी, तथा परमाणु और नाभिक का विस्तृत विवरण।",
        status: "available"
    }
];

module.exports = {
    SCHOOL_K12_BOOKS
};
