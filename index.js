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
let my_location = null;

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

const sendLocationRequest = async (replyToken) => {
    const message = {
        type: 'template',
        altText: 'กดเพื่อทำการส่งตำแหน่งที่อยู่สวนของคุณ',
        template: {
            type: 'buttons',
            text: 'กดเพื่อทำการส่งตำแหน่งที่อยู่สวนของคุณ',
            actions: [
                {
                    type: 'uri',
                    label: 'แชร์สถานที่',
                    uri: 'line://nv/location', // Opens the location sharing interface in Line
                },
            ],
        },
    };

    return client.replyMessage(replyToken, message);
}

const locationData = async (event) => {
    if (event.message && event.message.type === 'location') {
        my_location = {
            latitude: event.message.latitude,
            longitude: event.message.longitude
        };

        console.log('User Location:', my_location);
    } else {
        console.error('Invalid event data: Event does not contain location data');
        return null; // Return null if event is invalid
    }
};


//Get the weather function
const getWeatherData = async (event) => {
    const location = my_location;

    const { latitude, longitude } = location;
    console.log('Latitude:', latitude, 'Longitude:', longitude);

    try {
        const weatherAPI = await axios.get(
            `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&units=metric&appid=${env.OPEN_WEATHER_KEY}`
        );
        const { wind, main } = weatherAPI.data;

        const formattedData = {
            env_data: {
                AvgWind: wind.speed,
                MaxTemp: main.temp_max,
                AvgTemp: main.temp,
                MinTemp: main.temp_min,
                AvgHumidity: main.humidity
            }
        };

        return formattedData;
    } catch (error) {
        console.error('Error getting weather data:', error);
        return null;
    }
};

// Get the Predicted
const getPredictData = async (event) => {
    try {
        const weatherData = await getWeatherData(event);
        if (weatherData) {
            console.log('Weather data:', weatherData);
            const apiResponse = await axios.post('http://34.2.30.58:5000/predict', weatherData);

            console.log('API Response:', apiResponse.data.result / 25);

            // ตรวจสอบว่า response มี key "result"
            if (apiResponse.data && apiResponse.data.result !== undefined) {
                const resultValue = apiResponse.data.result / 25;
                // ส่งข้อความกลับไปยังผู้ใช้พร้อมค่าของ "result"
                await client.replyMessage(event.replyToken, {
                    type: 'text',
                    text: `ผลทำนายปริมาณน้ำยาง คือ: ${resultValue.toFixed(2)} กิโลกรัม/ไร่`// วัดจาก 25 ไร่
                    , quickReply: {
                        items: [
                            {
                                type: 'action',
                                action: {
                                    type: 'message',
                                    label: 'ทำนายผลผลิต',
                                    text: 'ทำนายผลผลิต'
                                }
                            },
                            {
                                type: 'action',
                                action: {
                                    type: 'message',
                                    label: 'ตำแหน่งของฉัน',
                                    text: 'ตำแหน่งของฉัน'
                                }
                            },
                            {
                                type: 'action',
                                action: {
                                    type: 'message',
                                    label: 'ช่วยเหลือ',
                                    text: 'ช่วยเหลือ'
                                }
                            }
                        ]
                    }
                });

            } else {
                // แจ้งข้อผิดพลาดหากไม่มี "result" ใน response
                await client.replyMessage(event.replyToken, {
                    type: 'text',
                    text: 'ข้อมูลถูกส่งสำเร็จ แต่ไม่พบค่า "result" ในการตอบกลับจาก server.',
                    quickReply: {
                        items: [
                            {
                                type: 'action',
                                action: {
                                    type: 'message',
                                    label: 'ทำนายผลผลิต',
                                    text: 'ทำนายผลผลิต'
                                }
                            },
                            {
                                type: 'action',
                                action: {
                                    type: 'message',
                                    label: 'ตำแหน่งของฉัน',
                                    text: 'ตำแหน่งของฉัน'
                                }
                            },
                            {
                                type: 'action',
                                action: {
                                    type: 'message',
                                    label: 'ช่วยเหลือ',
                                    text: 'ช่วยเหลือ'
                                }
                            }
                        ]
                    }
                });
            }
        }
    } catch (error) {
        console.error('Error sending data to API:', error);

        // แจ้งข้อผิดพลาดกลับไปยังผู้ใช้
        await client.replyMessage(event.replyToken, {
            type: 'text',
            text: 'กรุณาส่งตำแหน่งสวนของคุณก่อนทำนายผลผลิต',
            quickReply: {
                items: [
                    {
                        type: 'action',
                        action: {
                            type: 'message',
                            label: 'ทำนายผลผลิต',
                            text: 'ทำนายผลผลิต'
                        }
                    },
                    {
                        type: 'action',
                        action: {
                            type: 'message',
                            label: 'ตำแหน่งของฉัน',
                            text: 'ตำแหน่งของฉัน'
                        }
                    },
                    {
                        type: 'action',
                        action: {
                            type: 'message',
                            label: 'ช่วยเหลือ',
                            text: 'ช่วยเหลือ'
                        }
                    }
                ]
            }
        });
    }
}

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
            text: `วิธีการใช้งานแชทบอท:\n\n-ขั้นตอนแรก \n-พิมพ์ "ตำแหน่งของฉัน"\tเพื่อส่งตำแหน่งที่อยู่ของส่วนคุณเพื่อนำไปหาว่าสภาพอากาศบริเวณสวนของคุณเป็นอย่างไร -ขั้นตอนที่ 2 \n -พิมพ์ "ทำนายผลผลิต"\tเพื่อทำนายปริมาณน้ำยางที่ได้\n\n  
            \n-พิมพ์ "ช่วยเหลือ"เพื่อดูวิธีการใช้งาน`,
            quickReply: {
                items: [
                    {
                        type: 'action',
                        action: {
                            type: 'message',
                            label: 'ทำนายผลผลิต',
                            text: 'ทำนายผลผลิต'
                        }
                    },
                    {
                        type: 'action',
                        action: {
                            type: 'message',
                            label: 'ตำแหน่งของฉัน',
                            text: 'ตำแหน่งของฉัน'
                        }
                    },
                    {
                        type: 'action',
                        action: {
                            type: 'message',
                            label: 'ช่วยเหลือ',
                            text: 'ช่วยเหลือ'
                        }
                    }
                ]
            }
        });
    }

    if (event.type !== 'message' || (event.message.type !== 'text' && event.message.type !== 'location')) {
        return helperReply();
    }
    if (event.type === 'message') {

        if (event.message.type === 'location') {
            locationData(event);
        }
        if (event.message.type === 'text') {
            const message = event.message.text.toLowerCase();
            if (message === 'ทำนายผลผลิต') {
                getPredictData(event);
            }
            else if (message === 'ตำแหน่งของฉัน') {
                return sendLocationRequest(event.replyToken);
            }
            else {
                return helperReply();
            }
        }
        console.log(event.message.type);
    }

};


app.listen(8080, () => {
    console.log('Listening on 8080');
});
