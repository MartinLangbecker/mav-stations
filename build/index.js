'use strict'

const pipe = require('multipipe')
const through = require('through2')
const ndjson = require('ndjson')
const fs = require('fs')
const path = require('path')
const ms = require('ms')

const getStations = require('./stations')
const parseFull = require('./parse-full')
const parseSimplified = require('./parse-simplified')

const TOKEN = process.env.API_TOKEN
if (!TOKEN) {
	process.stderr.write('missing API_TOKEN\n')
	process.exit(1)
}

const showError = (err) => {
	if (!err) return
	console.error(err)
	process.exit(1)
}

const stations = getStations(TOKEN)

setInterval(() => {
	const p = stations.progress()
	console.info([
		Math.round(p.percentage) + '%',
		'–',
		p.transferred + '/' + p.length,
		'–',
		Math.round(p.speed) + '/s',
		'–',
		'ETA: ' + ms(p.eta)
	].join(' '))
}, 5 * 1000)

const src = pipe(
	stations,
	through.obj(function (s, _, cb) {
		const id = s.evaNumbers[0] ? s.evaNumbers[0].number + '' : null
		if (id) this.push(s)
		else console.error(`${s.name} (nr ${s.number}) has no IBNR`)
		cb()
	}),
	showError
)

pipe(
	src,
	parseSimplified(),
	ndjson.stringify(),
	fs.createWriteStream(path.join(__dirname, '../data.ndjson')),
	showError
)

pipe(
	src,
	parseFull(),
	ndjson.stringify(),
	fs.createWriteStream(path.join(__dirname, '../full.ndjson')),
	showError
)