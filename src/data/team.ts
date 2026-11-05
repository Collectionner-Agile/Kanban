export type PersonId = 'diego' | 'luis' | 'josediego' | 'brenda' | 'beth'

export type Person = {
  id: PersonId
  name: string
  /** Color del cursor, su etiqueta y la barra de avance: contraste AA bajo texto blanco. */
  color: string
  tint: string
  tintDeep: string
  skinLight: string
  skin: string
  skinShade: string
  skinDeep: string
  hair: string
  hairLight: string
  shirt: string
  shirtLight: string
  shirtDeep: string
  iris: string
  lip: string
  glasses: 'round' | 'square' | null
  frame: string
}

export const TEAM: Person[] = [
  {
    id: 'diego',
    name: 'Diego',
    color: '#8E3560',
    tint: '#EADCE3',
    tintDeep: '#D4BCC9',
    skinLight: '#F3CFB2',
    skin: '#E6B896',
    skinShade: '#CC9672',
    skinDeep: '#A8714F',
    hair: '#3A1D2B',
    hairLight: '#6E3A52',
    shirt: '#35426E',
    shirtLight: '#4A5A8F',
    shirtDeep: '#232D50',
    iris: '#5A3618',
    lip: '#B5705C',
    glasses: null,
    frame: '#1E1A1C',
  },
  {
    id: 'luis',
    name: 'Luis',
    color: '#8A5A05',
    tint: '#EFE6CF',
    tintDeep: '#DDCFA9',
    skinLight: '#CD9A75',
    skin: '#B57F5C',
    skinShade: '#976443',
    skinDeep: '#73482D',
    hair: '#17141A',
    hairLight: '#3F3A44',
    shirt: '#56633F',
    shirtLight: '#6D7C52',
    shirtDeep: '#3D4730',
    iris: '#3A2212',
    lip: '#8E5546',
    glasses: null,
    frame: '#1E1A1C',
  },
  {
    id: 'josediego',
    name: 'Jose Diego',
    color: '#1F6F5A',
    tint: '#D6E8DF',
    tintDeep: '#B5D3C5',
    skinLight: '#F6D8C1',
    skin: '#ECC6A9',
    skinShade: '#D3A583',
    skinDeep: '#B07F5E',
    hair: '#1B1A24',
    hairLight: '#44435A',
    shirt: '#6C7886',
    shirtLight: '#84909E',
    shirtDeep: '#515C69',
    iris: '#4E4A2A',
    lip: '#BE7C69',
    glasses: 'round',
    frame: '#1E1F2C',
  },
  {
    id: 'brenda',
    name: 'Brenda',
    color: '#B23D26',
    tint: '#F3DFD8',
    tintDeep: '#E3C3B8',
    skinLight: '#F8DECB',
    skin: '#F0CDB5',
    skinShade: '#D9AB8F',
    skinDeep: '#B9846A',
    hair: '#4C211A',
    hairLight: '#8A4632',
    shirt: '#2A2A32',
    shirtLight: '#40404B',
    shirtDeep: '#18181E',
    iris: '#37604C',
    lip: '#BF5454',
    glasses: 'square',
    frame: '#6E1F2C',
  },
  {
    id: 'beth',
    name: 'Beth',
    color: '#3F55BE',
    tint: '#DCE1F4',
    tintDeep: '#BFC8E8',
    skinLight: '#DBA982',
    skin: '#C58E69',
    skinShade: '#A8724F',
    skinDeep: '#835435',
    hair: '#241C2C',
    hairLight: '#54456A',
    shirt: '#BA7E24',
    shirtLight: '#D29A3F',
    shirtDeep: '#8F5F16',
    iris: '#3E2410',
    lip: '#A14E52',
    glasses: 'round',
    frame: '#4A2E66',
  },
]

export const PERSON = Object.fromEntries(TEAM.map((p) => [p.id, p])) as Record<PersonId, Person>
