var drives = [],
    files = [];

var error; //handler function of exceptions

/**
 * Конструктор класса
 *
 * @param label - идентификатор директории, в которую предполагается писать
 * @param folders - список директорий для записи и чтения
 * @param cfg - объект конфигурации, перепишет элементы считанного из config.js при совпадении ключей
 * @constructor
 */
function DriveAPI (label, folders, cfg)
{
    var config = {},
        self = this;
    $.ajax({
        async: false,
        url: "/js/driveAPI/config.js",
        dataType: "script",
        scriptCharset: 'UTF-8',
        success: function (data)
        {
            eval(data);
            self.config = cfg ? $.extend(config, cfg) : config;
        },
        error: function (jqXHR, textStatus)
        {
            throw new Error('Не удалось получить конфигурационный файл. Ошибка: ' + textStatus);
        }
    });

    folders = (folders && typeof folders == 'object') ? folders : {};
    this.folders = (this.config.FOLDERS && typeof this.config.FOLDERS == 'object') ? $.extend(this.config.FOLDERS, folders) : folders;

    this.checkConfig();

    if (label && this.folders[label])
    {
        this.label = label;
        this.folder_id = this.folders[label];
    }
    else
    {
        throw new Error('Объект не поддерживает работу с папкой ' + label + ' или метка папки не задана');
    }

    this.setToken();
}


/**
 *  Проверяет наличие и верный формат всех необходимых для корректной работы модуля директив конфигурации
 */
DriveAPI.prototype.checkConfig = function ()
{
    var cfg = this.config;
    if (cfg && typeof cfg == 'object')
    {
        if (cfg.FOLDERS == undefined)
        {
            throw new Error('Список папок с файлами пуст');
        }
        if (cfg.DRIVE_FILE_INFO == undefined)
        {
            throw new Error('Список полей информации о файле пуст');
        }
        if (cfg.BOUNDARY == undefined)
        {
            throw new Error('Значение разделителя тела multipart-запроса отсутствует');
        }
        if (cfg.CHUNK_SIZE == undefined)
        {
            throw new Error('В конфигурации отсутствует значение размера куска данных для resumable-записи');
        }
    }
    else
    {
        throw new Error('Конфигурация не инициализирована или имеет неверный формат');
    }
};

/**
 * Устанавливает массив директорий для записи
 *
 * @param folders - массив идентификаторов папок
 * @returns {*}
 */
DriveAPI.prototype.initFolders = function (folders)
{
    if (typeof folders == 'object')
    {
        this.folders = folders;
        return this.folders;
    }
    return false;
};

/**
 * Устанавливает активную директорию
 *
 * @param label - идетификатор директории
 * @returns {*}
 */
DriveAPI.prototype.setActiveFolder = function(label)
{
    if (this.folders[label])
    {
        this.label = label;
        this.folder_id = this.folders[label];
        return this.folder_id;
    }
    else
    {
        throw new Error('Объект не поддерживает работу с папкой ' + label)
    }
};


/**
 * Добавляет дополнительную директория для записи и чтения
 *
 * @param label - идентификатор директории в объекте
 * @param folder_id - идетификатор директории в хранилище
 * @returns {*}
 */
DriveAPI.prototype.addFolder = function (label, folder_id)
{
    if (folder_id && label)
    {
        return this.folders[label] = folder_id;
    }
    else
    {
        throw new Error('Неверно заданы параметры функции');
    }
};

/**
 * Удаляет элемент списка доступных директорий
 *
 * @param label - идентификатор удаляемой директории
 * @returns {*}
 */
DriveAPI.prototype.deleteFolder = function (label)
{
    delete this.folders[label];
    return this.folders;
};

/**
 * Получить информацию о загруженном файле
 *
 * @param callback - функция, выполняющаяся при успешном получении информации от хранилища
 * @param file_id - идетификатор файла в хранилище
 * @returns {boolean}
 */
DriveAPI.prototype.getFile = function (callback, file_id)
{
    var self = this;

    $.ajax({
        type: 'GET',
        url: 'https://www.googleapis.com/drive/v2/files/' + file_id,
        dataType: 'json',
        data:
        {
            fields: 'items(' + this.config.DRIVE_FILE_INFO + ')'
        },
        headers: {
            authorization: 'Bearer ' + this.token
        },
        async: true,
        success: callback ? callback : this.success,
        error: function ()
        {
            error('Не удалось получить файл');
        }
    });
    return false;
};

/**
 * Получить информацию обо всех файлах из директории
 *
 * @param callback - функция, выполняющаяся при успешном получении информации о файлах
 * @param folder_id - идентификатор директории
 * @returns {boolean}
 */
DriveAPI.prototype.getFiles = function (callback, folder_id)
{
    var self = this;

    $.ajax({
        type: 'GET',
        url: 'https://www.googleapis.com/drive/v2/files',
        dataType: 'json',
        data:
        {
            fields: 'items(' + this.config.DRIVE_FILE_INFO + ')',
            q: "'" + (folder_id ? folder_id : this.folder_id)  + "' in parents"
        },
        headers: {
            authorization: 'Bearer ' + this.token
        },
        async: true,
        success: callback ? callback : this.success,
        error: function ()
        {
            error('Не удалось получить список файлов из папки ' + self.label);
        }
    });
    return false;
};

/**
 * Загрузка файла в хранилище multipart-способом
 *
 * @param file - файл из input[type=file]
 * @param callback - функция-обработчик успешной загрузки
 * @param folder_id - идентификатор родительской директории для файла
 */
DriveAPI.prototype.uploadFile = function (file, callback, folder_id)
{
    var self = this,
        result;

    const delimiter = "\r\n--" + this.config.BOUNDARY + "\r\n";
    const close_delim = "\r\n--" + this.config.BOUNDARY + "--";

    var reader = new FileReader();

    reader.onloadend = function(event)
    {
        var contentType = file.type || 'application/octet-stream',
            metadata = {
                title: file.name,
                mimeType: contentType,
                parents: [
                    {
                        id: folder_id ? folder_id : self.folder_id
                    }
                ]
            };

        if (self.getInternetExplorerVersion() != -1)
        {
            result = self.IEBinary(event.target.result);
        }
        else
        {
            result = event.target.result;
        }
        var base64Data = btoa(result),
            multipartRequestBody =
                delimiter +
                'Content-Type: application/json\r\n\r\n' +
                JSON.stringify(metadata) +
                delimiter +
                'Content-Type: ' + contentType + '\r\n' +
                'Content-Transfer-Encoding: base64\r\n' +
                '\r\n' +
                base64Data +
                close_delim;


        $.ajax({
            type: 'POST',
            url: 'https://content.googleapis.com/upload/drive/v2/files?uploadType=multipart&fields=' + self.config.DRIVE_FILE_INFO,
            dataType: 'json',
            data: multipartRequestBody,
            processData: false,
            headers: {
                authorization: 'Bearer ' + self.token,
                'Content-Type': 'multipart/mixed; boundary="' + self.config.BOUNDARY + '"'
            },
            async: true,
            success: callback ? callback : self.success,
            error: function (jqXHR, textStatus)
            {
                error('Не удалось записать файл. Ошибка: ' + textStatus);
            }
        });
    };
    if (self.getInternetExplorerVersion() != -1)
    {
        reader.readAsArrayBuffer(file);
    }
    else
    {
        reader.readAsBinaryString(file);
    }
};

/**
 * Формирует байтовую последовательность из файла или части файла (актуально для IE)
 *
 * @param buffer - содержимое файла
 * @returns {string}
 * @constructor
 */
DriveAPI.prototype.IEBinary = function (buffer)
{
    var binary = '',
        bytes = new Uint8Array(buffer),
        length = bytes.byteLength;

    for (var i = 0; i < length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }

    return binary;
};

/**
 * Формирует заголовок для задания интервала байт, части файла, которая будет отправляться на сервер
 *
 * @param total_size - общий размер файла в байтах
 * @param last_size - начальное значение для интервала
 * @returns {string}
 */
DriveAPI.prototype.getChunkRange = function (total_size, last_size)
{
    if (last_size + this.config.CHUNK_SIZE < total_size)
    {
        return 'bytes ' + last_size + '-' + (last_size + this.config.CHUNK_SIZE - 1) + '/' + total_size;
    }
    else
    {
        return 'bytes ' + last_size + '-' + (total_size - 1) + '/' + total_size;
    }
};

/**
 * Загрузка файла на сервер с использование докачки
 *
 * @param file - файл из input[type=file]
 * @param callback - функция-обработчик успешной загрузки файла
 * @param folder_id - идентификатор родительской директории для файла
 */
DriveAPI.prototype.uploadResumable = function (file, callback, folder_id)
{
    var self = this,
        reader = new FileReader(),
        upload_id;

    var data = JSON.stringify({
            parents: [
                {
                    id: folder_id ? folder_id : this.folder_id
                }
            ],
            title: file.name
        }),
        try_count = 0,
        shank = file.size,
        last_size = 0,
        result,
        len = 0;

    $.ajax({
        type: 'POST',
        url: 'https://www.googleapis.com/upload/drive/v2/files?uploadType=resumable',
        dataType: 'json',
        contentType: 'application/json',
        data: data,
        processData: false,
        headers: {
            authorization: 'Bearer ' + self.token,
            'X-Upload-Content-Type': file.type
        },
        async: true,
        complete: function (headers)
        {
            if (headers.status == 200)
            {
                upload_id = headers.getResponseHeader('Location').split('upload_id=');
                if (upload_id[1])
                {
                    upload_id = upload_id[1];
                    len = self.readChunk(reader, file, shank, last_size);
                    return false;
                }
                error('Не удалось записать файл. Повторите позже');
            }
        }
    });

    reader.onloadend = function(event)
    {
        if (self.getInternetExplorerVersion() != -1)
        {
            result = self.IEBinary(event.target.result);
        }
        else
        {
            result = event.target.result;
        }

        $.ajax({
            type: 'PUT',
            url: 'https://www.googleapis.com/upload/drive/v2/files?uploadType=resumable&upload_id=' + upload_id,
            data: btoa(result),
            contentType: file.type,
            async: false,
            headers: {
                'Content-Range': self.getChunkRange(file.size, last_size),
                'Content-Encoding': 'base64'
            },
            statusCode: {
                308: function ()
                {
                    last_size += self.config.CHUNK_SIZE;
                    shank -= len;
                    len = self.readChunk(reader, file, shank, last_size);
                },
                503: function ()
                {
                    if (try_count < 4)
                    {
                        setTimeout( function ()
                        {
                            self.readChunk(reader, file, shank, last_size);
                        }, Math.pow(2, try_count) * 1000 + Math.ceil(Math.random() * 1000));
                        try_count++;
                    }
                    else
                    {
                        throw new Error('Не удалось записать файл. Повторите позже');
                    }
                }
            },
            success: callback ? callback : self.success
        });
    };
};

/**
 * Читает часть файла
 *
 * @param reader - объект FileReader()
 * @param file - файл
 * @param shank - размер считываемого куска
 * @param last_size - с какого места читать
 * @returns {*}
 */
DriveAPI.prototype.readChunk = function (reader, file, shank, last_size)
{
    var len = shank < this.config.CHUNK_SIZE ? shank : this.config.CHUNK_SIZE,
        data = file.slice(last_size, last_size + len);

    if (this.getInternetExplorerVersion() != -1)
    {
        reader.readAsArrayBuffer(data);
    }
    else
    {
        reader.readAsBinaryString(data);
    }
    return len;
};

/**
 * Меняет уже загруженный в хранилище файл на новый, загруженный multipart-способом
 *
 * @param file - файл из input[type=file]
 * @param file_id - идентификатор меняемого файла
 * @param callback - функция-обработчик успешного изменения файла
 */
DriveAPI.prototype.updateFile = function (file, file_id, callback)
{
    var self = this,
        result;

    const delimiter = "\r\n--" + this.config.BOUNDARY + "\r\n";
    const close_delim = "\r\n--" + this.config.BOUNDARY + "--";

    var reader = new FileReader();

    reader.onloadend = function(event)
    {
        var contentType = file.type || 'application/octet-stream',
            metadata = {
                title: file.name,
                mimeType: contentType,
                parents: [
                    {
                        id: file_id
                    }
                ]
            };

        if (self.getInternetExplorerVersion() != -1)
        {
            result = self.IEBinary(event.target.result);
        }
        else
        {
            result = event.target.result;
        }
        var base64Data = btoa(event.target.result),
            multipartRequestBody =
                delimiter +
                'Content-Type: application/json\r\n\r\n' +
                JSON.stringify(metadata) +
                delimiter +
                'Content-Type: ' + contentType + '\r\n' +
                'Content-Transfer-Encoding: base64\r\n' +
                '\r\n' +
                base64Data +
                close_delim;


        $.ajax({
            type: 'PUT',
            url: 'https://www.googleapis.com/upload/drive/v2/files/' + file_id + '?uploadType=multipart&fields=' + self.config.DRIVE_FILE_INFO,
            dataType: 'json',
            data: multipartRequestBody,
            processData: false,
            headers: {
                authorization: 'Bearer ' + self.token,
                'Content-Type': 'multipart/mixed; boundary="' + this.config.BOUNDARY + '"'
            },
            async: true,
            success: callback ? callback : self.success,
            error: function (jqXHR, textStatus)
            {
                error('не удалось изменить файл. Ошибка: ' + textStatus);
            }
        });
    };
    if (self.getInternetExplorerVersion() != -1)
    {
        reader.readAsArrayBuffer(f);
    }
    else
    {
        reader.readAsBinaryString(f);
    }
};

/**
 * Меняет уже загруженный в хранилище файл на новый, загруженный resumable-способом
 *
 * @param file - файл из input[type=file]
 * @param file_id - идентификатор меняемого файла
 * @param callback - функция-обработчик успешного изменения файла
 */
DriveAPI.prototype.updateResumable = function (file, file_id, callback)
{
    var self = this,
        reader = new FileReader(),
        upload_id;

    var data = JSON.stringify({
            title: file.name
        }),
        try_count = 0,
        shank = file.size,
        last_size = 0,
        result,
        len = 0;

    $.ajax({
        type: 'POST',
        url: 'https://www.googleapis.com/upload/drive/v2/files/' + file_id + '?uploadType=resumable',
        dataType: 'json',
        contentType: 'application/json',
        data: data,
        processData: false,
        headers: {
            authorization: 'Bearer ' + self.token,
            'X-Upload-Content-Type': file.type
        },
        async: true,
        complete: function (headers)
        {
            if (headers.status == 200)
            {
                upload_id = headers.getResponseHeader('Location').split('upload_id=');
                if (upload_id[1])
                {
                    upload_id = upload_id[1];
                    len = self.readChunk(reader, file, shank, last_size);
                    return false;
                }
                error('Не удалось записать файл. Повторите позже');
            }
        }
    });

    reader.onloadend = function(event)
    {
        if (self.getInternetExplorerVersion() != -1)
        {
            result = self.IEBinary(event.target.result);
        }
        else
        {
            result = event.target.result;
        }

        $.ajax({
            type: 'PUT',
            url: 'https://www.googleapis.com/upload/drive/v2/files?uploadType=resumable&upload_id=' + upload_id,
            data: btoa(result),
            contentType: file.type,
            async: false,
            headers: {
                'Content-Range': self.getChunkRange(file.size, last_size),
                'Content-Encoding': 'base64'
            },
            statusCode: {
                308: function ()
                {
                    last_size += self.config.CHUNK_SIZE;
                    shank -= len;
                    len = self.readChunk(reader, file, shank, last_size);
                },
                503: function ()
                {
                    if (try_count < 4)
                    {
                        setTimeout( function ()
                        {
                            self.readChunk(reader, file, shank, last_size);
                        }, Math.pow(2, try_count) * 1000 + Math.ceil(Math.random() * 1000));
                        try_count++;
                    }
                    else
                    {
                        throw new Error('Не удалось записать файл. Повторите позже');
                    }
                }
            },
            success: callback ? callback : self.success
        });
    };
};

/**
 * Создает директорию в хранилище и возвращает ее идентификатор
 *
 * @param callback - обработчик успешного создания директории
 * @param parent_id - родительская директория для создаваемой
 */
DriveAPI.prototype.createFolder = function (callback, parent_id)
{
    $.ajax({
        type: 'POST',
        url: 'https://www.googleapis.com/drive/v2/files?fields=id',
        dataType: 'json',
        data: JSON.stringify({
            title: Date.now(),
            parents:
                [
                    {
                        id: parent_id ? parent_id : this.folder_id
                    }
                ],
            mimeType: "application/vnd.google-apps.folder"
        }),
        processData: false,
        headers:
        {
            authorization: 'Bearer ' + this.token,
            'Content-Type': 'application/json'
        },
        async: true,
        success: callback ? callback : this.success,
        error: function (jqXHR, textStatus)
        {
            error('Не удалось создать директорию. Ошибка: ' + textStatus);
        }
    });
};

/**
 * Удаляет файл или директорию из хранилища
 *
 * @param id - идентификатор обекта для удаления
 * @param callback - обработчик успешного удаления
 */
DriveAPI.prototype.delete = function (id, callback)
{
    var self = this;

    $.ajax({
        type: 'DELETE',
        url: 'https://www.googleapis.com/drive/v2/files/' + id,
        dataType: 'json',
        headers:
        {
            authorization: 'Bearer ' + this.token,
            'Content-Type': 'application/json'
        },
        async: true,
        success: callback ? callback : this.success,
        error: function (jqXHR, textStatus)
        {
            error('Не удалось удалить файл или директорию. Ошибка: ' + textStatus);
        }
    });
};

/**
 * Возвращает версию браузера, если это IE
 *
 * @returns {number}
 */
DriveAPI.prototype.getInternetExplorerVersion = function ()
{
    var rv = -1;
    if (navigator.appName == 'Microsoft Internet Explorer')
    {
        var ua = navigator.userAgent,
            re  = new RegExp("MSIE ([0-9]{1,}[\.0-9]{0,})");

        if (re.exec(ua) != null)
            rv = parseFloat( RegExp.$1 );
    }
    else if (navigator.appName == 'Netscape')
    {
        var ua = navigator.userAgent,
            re  = new RegExp("Trident/.*rv:([0-9]{1,}[\.0-9]{0,})");

        if (re.exec(ua) != null)
            rv = parseFloat( RegExp.$1 );
    }
    return rv;
};

/**
 * Запрашивает у сервера токен для доступа к хранилищу и сохраняет его в объекте
 *
 * @returns {boolean}
 */
DriveAPI.prototype.setToken = function ()
{
    if (!this.token)
    {
        var self = this;
        $.ajax({
            async: false,
            url: this.config.SERVER_URL,
            success: function (token)
            {
                if (token.length == 77)
                {
                    self.token = token;
                }
                else
                {
                    throw new Error('Получен неверный токен от сервера');
                }
            },
            error: function ()
            {
                throw new Error('Получен неверный токен от сервера');
            }
        });
        return true;
    }
    return false;
};

/**
 * Удаляет токен для доступа к хранилищу
 */
DriveAPI.prototype.deleteToken = function ()
{
    this.token = false;
};