# homebridge-innova

A Homebridge plugin for the Innova 2.0 air conditioning unit.


## Pre-requisites

- Homebridge
- Innova 2.0 air conditioning unit


## Setup

`$ npm install homebridge-innova`


## Configuration

Parameters:

name|description
---|---
accessory|Should be `InnovaAirCo`. ****Required***
host|IP address (or hostname). ****Required***
name|A name for the accessory. **Not required*
fan|When set to `true` adds a fan control to the accessory. **Not required*
maxCoolingTemp|35 by default. **Not required*
minCoolingTemp|10 by default. **Not required*
maxHeatingTemp|25 by default. **Not required*
minHeatingTemp|0 by default. **Not required*

Configuration example:

```json
"accessories": [
  {
    "accessory": "InnovaAirCo",
    "name": "Air conditioning"
  },
 ]
```

## Technical notes

### Tested on

- Innova 2.0 *CONDIZ. 2.0 12 HP DC ELEC INVERTER*