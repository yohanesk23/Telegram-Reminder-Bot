'use strict'

const csv = require('csv-parser')
const axios = require('axios').default

/**
 * Process the Lambda event
 * @param {Object} event 
 * @returns {Promise<string>}
 * @throws {Error}
 */
module.exports.processEvent = async (event) => {
  console.log(event)
  const { body } = event

  if (body && (JSON.parse(body)?.message?.text !== '/schedule@discipleBot_bot' || JSON.parse(body)?.message?.text !== '/schedule')) return 'Not processing request as command is not valid'

  console.log('Fetching data from Google Sheet..')
  const results = await fetchDataFromGoogleSheet()
  console.log('All Results:', results)

  const filteredEventsForNextWeek = getAllEventsWithinNext7Days(results)
  console.log('Filtered Events for Next Week:', filteredEventsForNextWeek)

  for (const reminderEvent of filteredEventsForNextWeek) {
    console.log('Sending message to Telegram For Reminder Event...', reminderEvent)
    await sendMessageToTelegram(convertObjectToMessage(reminderEvent))
    console.log('Successfully sent message to Telegram...')
  }

  return 'Completed processing successfully!'
}

/**
 * Parses the CSV into Objects and pushes them into an Array which is returned back.
 * @returns {Promise<Array>}
 */
const fetchDataFromGoogleSheet = async () => {
  let results = []

  const { data } = await downloadGoogleSheet()

  return new Promise((resolve, reject) => {
    data
      .pipe(csv())
      .on('data', data => results.push(data))
      .on('end', () => resolve(results))
      .on('error', err => reject(err))
  })
}

/**
 * Downloads the Google Sheet as a readable stream to be piped into the 
 * CSV parser.
 * @returns {Promise<AxiosResponse>}
 */
const downloadGoogleSheet = async () => {
  const url = `https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEET_ID}/export?format=csv&id=${process.env.GOOGLE_SHEET_ID}&gid=${process.env.GID}&range=${2023}!A2:Z`
  return axios.get(url, { responseType: 'stream' })
}

/**
 * Sends message to Telegram
 *
 * @param {string} message
 * @returns {Promise<AxiosResponse>}
 */
const sendMessageToTelegram = async (message) => {
  const url = `https://api.telegram.org/bot${process.env.BOT_API_KEY}/sendMessage?chat_id=${process.env.GROUP_CHAT_ID}&text=${encodeURIComponent(message)}&parse_mode=markdown`
  return axios.get(url)
}

/**
 * Converts an object into a message string
 * @param {Object} object 
 * @returns {string}
 */
const convertObjectToMessage = (object) => {
  let message = '';
  for (const [key, value] of Object.entries(object)) {
    message += `*${key}*: ${value}\n`;
  }

  return message.trim()
}

/**
 * Filters the events to only return the ones within the next week.
 * @param {Array} events
 * @returns {Array}
 */
const getAllEventsWithinNext7Days = (events = []) => {
  const currentStartOfDay = new Date(new Date().setHours(0, 0, 0, 0))
  const tomorrowStartOfDay = new Date(new Date(currentStartOfDay).setDate(currentStartOfDay.getDate() + 1))
  const nextWeekStartOfDay = new Date(new Date(currentStartOfDay).setDate(currentStartOfDay.getDate() + 8))

  return events.filter(event => {
    const eventDateStartOfDay = new Date(new Date(event.Date).setHours(0, 0, 0, 0))
    return eventDateStartOfDay >= tomorrowStartOfDay && eventDateStartOfDay < nextWeekStartOfDay
  })
}