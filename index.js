const line = require('@line/bot-sdk');
const express = require('express');
const dotenv = require('dotenv');

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

    // Handle "follow" event when a user starts a chat with the bot
    if (event.type === 'follow') {
        console.log(`New user started chat: ${userId}`);
        return client.replyMessage(event.replyToken, {
            type: "sticker",
            packageId: "11537",
            stickerId: "52002734",
            quickReply: {
                items: [
                    {
                        type: 'action',
                        action: {
                            type: 'message',
                            label: 'Start',
                            text: 'start'
                        }
                    },
                    {
                        type: 'action',
                        action: {
                            type: 'message',
                            label: 'Help',
                            text: 'help'
                        }
                    }
                ]
            }
        });
    }

    // Help reply action function
    const helperReply = () => {
        return client.replyMessage(event.replyToken, {
            type: 'text',
            text: 'วิธีการใช้เรา:\n- พิมพ์ "start" เพื่อเริ่มต้นกรอกข้อมูล.\n- พิมพ์ "help" เพื่อขอความช่วยเหลือ.',
            quickReply: {
                items: [
                    {
                        type: 'action',
                        action: {
                            type: 'message',
                            label: 'Start',
                            text: 'start'
                        }
                    },
                    {
                        type: 'action',
                        action: {
                            type: 'message',
                            label: 'Help',
                            text: 'help'
                        }
                    }
                ]
            }
        });
    };

    // Check when event is not a text message
    if (event.type !== 'message' || event.message.type !== 'text') {
        return helperReply();
    }

    // When the message event is text
    if (event.type === 'message' && event.message.type === 'text') {
        const message = event.message.text.toLowerCase();

        // Helper function to check if the input is a valid date (m/d/y format)
        const isValidDate = (date) => {
            const dateRegex = /^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/\d{4}$/; // m/d/y format
            return dateRegex.test(date);
        };

        // Helper function to check if the input is a valid number
        const isValidNumber = (number) => {
            return !isNaN(number) && number.trim() !== '';
        };

        if (!userInput[userId]) {
            userInput[userId] = {
                step: 0,
                data: {} // Collect user data
            };
        }

        const userState = userInput[userId];
        const prompts = [
            "Please enter date (m/d/y):",
            "Enter MaxWind (km/h):",
            "Enter AvgWind:",
            "Enter MinWind:",
            "Enter MaxTemp (°C):",
            "Enter AvgTemp:",
            "Enter MinTemp:",
            "Enter MaxHumidity (%):",
            "Enter AvgHumidity:",
            "Enter MinHumidity:",
            "Enter AvgPrecip (mm):",
            "Enter TotalPrecip:",
            "Enter TotalRubber (Kg.):"
        ];
        const keys = [
            "date", "MaxWind", "AvgWind", "MinWind", "MaxTemp", "AvgTemp", "MinTemp",
            "MaxHumidity", "AvgHumidity", "MinHumidity", "AvgPrecip", "TotalPrecip", "TotalRubber"
        ];

        console.log(`User ID: ${userId}, Step: ${userState.step}, Message: ${message}`);

        // Save the user's response to the appropriate key if needed
        if (userState.step > 0) {
            const key = keys[userState.step - 1]; // Get the key based on the step

            // Validate the input before saving it
            if (key === "date") {
                // Validate the date format
                if (!isValidDate(message)) {
                    return client.replyMessage(event.replyToken, {
                        type: 'text',
                        text: "Invalid date format. Please enter the date in m/d/y format."
                    });
                }
            } else if (["MaxWind", "AvgWind", "MinWind", "MaxTemp", "AvgTemp", "MinTemp", "MaxHumidity", "AvgHumidity", "MinHumidity", "AvgPrecip", "TotalPrecip", "TotalRubber"].includes(key)) {
                // Validate if the input is a valid number
                if (!isValidNumber(message)) {
                    return client.replyMessage(event.replyToken, {
                        type: 'text',
                        text: `Invalid input for ${key}. Please enter a valid number.`
                    });
                }
            }

            // Save the valid response to userState.data
            userState.data[key] = message;
        }

        // Check if all steps are completed before sending response
        if (userState.step < prompts.length) {
            // Ask the next question
            const nextPrompt = prompts[userState.step];
            userState.step += 1;
            return client.replyMessage(event.replyToken, {
                type: 'text',
                text: nextPrompt
            });
        }

        // When all steps are completed, send the collected data
        console.log('Collected data:', userState.data); // Debugging
        const jsonResponse = JSON.stringify(userState.data, null, 2);

        // Send JSON back to the user
        await client.replyMessage(event.replyToken, {
            type: 'text',
            text: `ขอบคุณสำหรับข้อมูลที่จำเป็นครับ:\n${jsonResponse}`
        });

        // Reset user state AFTER sending the message
        userInput[userId] = undefined;
        return;


    }
};

app.listen(8080, () => {
    console.log('Listening on 8080');
});
