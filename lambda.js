const axios = require('axios')
const redis = require('redis')

const checkDiceHealth = async () => {
    console.log("Checking DICE health")
    try {
        await axios.get(process.env.DICE_URL)
        console.log("DICE is UP")
        return true;
    } catch (error) {
        console.log(error.toJSON())
        return false;
    }
}

exports.handler = async (event) => {
    const cacheKey = "dice-health"
    let errorResponse = {
        statusCode: 500,
        headers: { "content-type": "application/json" },
        body: 'something went wrong.'
    }
    let successResponse = {
        statusCode: 200,
        headers: { "content-type": "application/json" },
        body: "Bye!"
    }
    const up = "UP"
    const down = "DOWN"
    const redisClient = redis.createClient({ url: process.env.REDIS_URL })
    redisClient.on("error", function (err) {
        errorResponse.body = "redis client connecting error: " + err
        console.log(err)
        return errorResponse
    })
    await redisClient.connect()
    if (event.source === 'aws.events') {
        if (await checkDiceHealth()) {
            await redisClient.set(cacheKey, up)
        } else {
            await redisClient.set(cacheKey, down)
        }
        await redisClient.disconnect()
        return "Status Updated"
    } else {
        let status = await redisClient.get(cacheKey)

        if (status != null) {
            console.log(`Fetched from Redis Cache: ${cacheKey} : ${status}`)
        } else {
            if (await checkDiceHealth()) {
                await redisClient.set(cacheKey, up)
                status = up
            } else {
                await redisClient.set(cacheKey, down)
                status = down
            }
        }
        successResponse.body = JSON.stringify({
            status: status
        })
        await redisClient.disconnect()
        return successResponse
    }
}