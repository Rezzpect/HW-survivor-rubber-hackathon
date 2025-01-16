const line = require('@line/bot-sdk');
const express = require('express');
const dotenv = require('dotenv');
const axios = require('axios');

const env = dotenv.config().parsed;
const app = express();

const lineConfig = {
    channelAccessToken: env.ACCESS_TOKEN,
    channelSecret: env.SECRET_TOKEN
};

const client = new line.Client(lineConfig);

let userInput = {}; // Object to store user input

app.post('/webhook', line.middleware(lineConfig), async (req, res) => {
    try {
        const events = req.body.events;
        console.log('events=>>>', events);
        return events.length > 0
            ? await Promise.all(events.map(item => handleEvent(item)))
            : res.status(200).send("OK");
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).end();
    }
});


const handleEvent = async (event) => {
    const userId = event.source.userId;

    if (event.type === 'follow') {
        console.log(`New user started chat: ${userId}`);
        return client.replyMessage(event.replyToken, {
            type: "sticker",
            packageId: "11537",
            stickerId: "52002734",
        });
    }

    const helperReply = () => {
        return client.replyMessage(event.replyToken, {
            type: 'text',
            text: `วิธีการใช้เรา:\n- พิมพ์อะไรก็ได้เพื่อเริ่มต้นกรอกข้อมูลสภาพอากาศในพื้นที่ของคุณ.\n- เช่น พิมพ์ 'hi'`
        });
    };

    const isValidNumber = (number) => {
        return !isNaN(number) && number.trim() !== '';
    };

    if (event.type !== 'message' || event.message.type !== 'text') {
        return helperReply();
    }

    if (event.type === 'message' && event.message.type === 'text') {
        const message = event.message.text.toLowerCase();

        if (!userInput[userId]) {
            userInput[userId] = {
                step: 0,
                env_data: {}
            };
        }

        const userState = userInput[userId];
        const prompts = [
            "Enter MaxWind (km/h):",
            "Enter AvgWind (km/h):",
            "Enter MinWind (km/h):",
            "Enter MaxTemp (°C):",
            "Enter AvgTemp (°C):",
            "Enter MinTemp (°C):",
            "Enter MaxHumidity (%):",
            "Enter AvgHumidity (%):",
            "Enter MinHumidity (%):",
            "Enter AvgPrecip (mm):",
        ];
        const keys = [
            "MaxWind", "AvgWind", "MinWind", "MaxTemp", "AvgTemp", "MinTemp",
            "MaxHumidity", "AvgHumidity", "MinHumidity", "AvgPrecip"
        ];

        console.log(`User ID: ${userId}, Step: ${userState.step}, Message: ${message}`);

        if (userState.step > 0) {
            const key = keys[userState.step - 1];

            if (["MaxWind", "AvgWind", "MinWind", "MaxTemp", "AvgTemp", "MinTemp", "MaxHumidity", "AvgHumidity", "MinHumidity", "AvgPrecip"].includes(key)) {
                if (!isValidNumber(message)) {
                    return client.replyMessage(event.replyToken, {
                        type: 'text',
                        text: `ข้อมูลอินพุตไม่ถูกต้องสำหรับ ${key}. กรุณากรอกข้อมูลเป็นตัวเลข`
                    });
                }
            }

            userState.env_data[key] = parseFloat(message);
        }

        if (userState.step < prompts.length) {
            const nextPrompt = prompts[userState.step];
            userState.step += 1;
            return client.replyMessage(event.replyToken, {
                type: 'text',
                text: nextPrompt
            });
        }

        console.log('Collected data:', userState.env_data);
        const jsonPayload = {
            env_data: userState.env_data
        };

        // ส่ง JSON ไปยัง API
        axios.post('http://34.2.30.58:5000/predict', jsonPayload) // ส่ง object ไปได้โดยตรง ไม่ต้อง stringify
        try {
            const apiResponse = await axios.post('http://34.2.30.58:5000/predict', jsonPayload);

            console.log('API Response:', apiResponse.data);

            // ตรวจสอบว่า response มี key "result"
            if (apiResponse.data && apiResponse.data.result !== undefined) {
                const resultValue = apiResponse.data.result;
                   // ส่งข้อความกลับไปยังผู้ใช้พร้อมค่าของ "result"
                   await client.replyMessage(event.replyToken, {
                    type: 'text',
                    text: `ข้อมูลสภาพอากาศของคุณถูกส่งสำเร็จ! ผลทำนายปริมาณน้ำยาง คือ: ${resultValue/25} กิโลกรัม/ไร่` // วัดจาก 25 ไร่
                });

            } else {
                // แจ้งข้อผิดพลาดหากไม่มี "result" ใน response
                await client.replyMessage(event.replyToken, {
                    type: 'text',
                    text: 'ข้อมูลถูกส่งสำเร็จ แต่ไม่พบค่า "result" ในการตอบกลับจาก server.'
                });
            }
        } catch (error) {
            console.error('Error sending data to API:', error);

            // แจ้งข้อผิดพลาดกลับไปยังผู้ใช้
            await client.replyMessage(event.replyToken, {
                type: 'text',
                text: 'เกิดข้อผิดพลาดในการส่งข้อมูลไปยัง server กรุณาลองอีกครั้ง.'
            });
        }

        // Reset user state AFTER sending the message
        userInput[userId] = undefined;
        return;
    }
};



app.listen(8080, () => {
    console.log('Listening on 8080');
});
