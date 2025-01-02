const line = require('@line/bot-sdk')
const express = require('express')
const axios = require('axios').default
const dotenv = require('dotenv')

const env = dotenv.config().parsed
const app = express()

const lineConfig = {
    channelAccessToken: env.ACCESS_TOKEN,
    channelSecret: env.SECRET_TOKEN
}

const client = new line.Client(lineConfig)

app.post('/webhook', line.middleware(lineConfig), async (req, res) => {
    try {
        const events = req.body.events
        console.log('events=>>>',events)
        return events.length > 0 ? await events.map(item => handleEvent(item)) : res.status(200).sent("OK")
    }
    catch (error){
        res.status(500).end()
    }
});

const handleEvent = async (event) => {
    console.log(event)
    return client.replyMessage(event.replyToken, {type:'text',text:'Hello'})
}
 
app.listen(8080, () => {
    console.log('Listening on 8080')
});