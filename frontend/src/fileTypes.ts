// The files the backend can read: tables, and the text files that instruments write.
export const TABLE_EXTENSIONS = ['.csv', '.xlsx']
export const INSTRUMENT_EXTENSIONS = ['.txt', '.tsv', '.dat', '.xy', '.xye', '.asc']

// For the accept attribute of a file input.
export const FILE_ACCEPT = [...TABLE_EXTENSIONS, ...INSTRUMENT_EXTENSIONS].join(',')
