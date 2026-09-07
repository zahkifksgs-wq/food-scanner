const express = require('express');
const multer = require('multer');
const cors = require('cors');
const dotenv = require('dotenv');
const axios = require('axios');
const path = require('path');

dotenv.config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 1. AI Visual Food Recognition (using OpenAI GPT-4o Vision API)
app.post('/api/scan-food', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "کوئی تصویر فراہم نہیں کی گئی" });
        }

        const base64Image = req.file.buffer.toString('base64');
        const apiKey = process.env.OPENAI_API_KEY;

        if (!apiKey) {
            return res.status(500).json({ error: "OpenAI API Key تلاش نہیں ہو سکی (.env میں کی درج کریں)" });
        }

        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: "gpt-4o",
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: `Analyze this food image. Identify the food item and estimate its calories and macros per standard serving size.
                                Return ONLY a JSON object (no markdown formatting, no backticks) with this structure:
                                {
                                    "foodName": "Food Name in English",
                                    "foodNameUrdu": "کھانے کا نام اردو میں",
                                    "servingSize": "e.g., 1 plate or 200g",
                                    "calories": 350,
                                    "protein": "15g",
                                    "carbs": "45g",
                                    "fat": "12g",
                                    "confidence": "High / Medium / Low",
                                    "healthAdvice": "Short health note about this food"
                                }`
                            },
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:${req.file.mimetype};base64,${base64Image}`
                                }
                            }
                        ]
                    }
                ],
                max_tokens: 500
            },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        let content = response.data.choices[0].message.content.trim();
        // Remove potential markdown code blocks if returned
        content = content.replace(/^```json/g, '').replace(/```$/g, '').trim();

        const result = JSON.parse(content);
        res.json({ success: true, data: result });

    } catch (error) {
        console.error(error.response?.data || error.message);
        res.status(500).json({ error: "سکیننگ ناکام ہو گئی۔ دوبارہ کوشش کریں۔" });
    }
});

// 2. Barcode Search API (Open Food Facts integration)
app.get('/api/barcode/:code', async (req, res) => {
    try {
        const barcode = req.params.code;
        const response = await axios.get(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`);

        if (response.data.status === 1) {
            const p = response.data.product;
            const nutriments = p.nutriments || {};
            
            res.json({
                success: true,
                data: {
                    foodName: p.product_name || "Unknown Product",
                    foodNameUrdu: p.product_name || "نامعلوم پروڈکٹ",
                    servingSize: p.serving_size || "100g",
                    calories: Math.round(nutriments['energy-kcal_100g'] || nutriments['energy-kcal'] || 0),
                    protein: `${nutriments.proteins_100g || 0}g`,
                    carbs: `${nutriments.carbohydrates_100g || 0}g`,
                    fat: `${nutriments.fat_100g || 0}g`,
                    confidence: "100% Exact Barcode Match",
                    healthAdvice: `Nutri-Score: ${p.nutriscore_grade ? p.nutriscore_grade.toUpperCase() : 'N/A'}`
                }
            });
        } else {
            res.status(404).json({ error: "بارکوڈ ڈیٹا بیس میں نہیں ملا" });
        }
    } catch (error) {
        res.status(500).json({ error: "بارکوڈ تلاش کرنے میں ناکامی" });
    }
});

const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

module.exports = app;