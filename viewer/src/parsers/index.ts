import { V06Parser } from './0.6/parser'
import { V05Parser } from './0.5/parser'

import { V04Parser } from './0.4/parser'

import { V03Parser } from './0.3/parser'

import { V02Parser } from './0.2/parser'

import { V01Parser } from './0.1/parser'

const parsers = {
  'v06': V06Parser,
  'v05': V05Parser,
  'v04': V04Parser,
  'v03': V03Parser,
  'v02': V02Parser,
  'v01': V01Parser

}

export { parsers as parsers }

