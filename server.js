const express = require('express');
const cors = require('cors');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

app.post('/api/scan-food', async (req, res) => {
    try {
        const { image } = req.body;
        if (!image) {
            return res.status(400).json({ error: 'Tasveer nahi mili.' });
        }

        const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const prompt = "Identify the food item in this image. Provide the answer ONLY in valid JSON format with keys: food_name, calories, protein, carbs, fat. Do not include markdown code block formatting like ```json.";

        const imagePart = {
            inlineData: {
                data: base64Data,
                mimeType: 'image/jpeg'
            }
        };

        const result = await model.generateContent([prompt, imagePart]);
        const responseText = result.response.text().trim();
        
        let parsedData;
        try {
            const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            parsedData = JSON.parse(cleanJson);
        } catch (e) {
            parsedData = { food_name: responseText, calories: 'N/A', protein: 'N/A', carbs: 'N/A', fat: 'N/A' };
        }

        res.json({ success: true, data: parsedData });
    } catch (error) {
        console.error('Gemini Error:', error);
        res.status(500).json({ error: 'Khane ki shanakht na ho saki: ' + error.message });
    }
});

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;