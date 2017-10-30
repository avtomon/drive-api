config = {
    /**
     * Адреса папок на Google-диске куда будут падать файлы
     */
    FOLDERS: {
        'Видеолекция': '0B-e8MNz22zZvflNxd2NzYWxnSVFxdDFDX2ZpVEdXaUo3dVRQQmJjMWttTnRtRUNNZG9YNHc',
        'Конспект лекций': '0B-e8MNz22zZvfnZhY2RQWTNCQUdXemtzOFV5TVJlQ1lqa0JyUVJFbXJYd2dfWHFQR1ZGTW8',
        'Рекомендуемая литература': '0B-e8MNz22zZvfmN3c0o5cXc5SFlraFBDZVZmT0Z3ZV84WjlDMHYwc0owelVHeHFtSWllQVU',
        'Видеоматериал': '0B-e8MNz22zZvfk9wS0o1c2JMZHIyV2xDeHFwLWQ2anJHQTB5YzNlVDg3YjJKX1ZHTVlEMVk',
        'Аудиоматериал': '0B-e8MNz22zZvfnllb3gtM1VlRHlral9FQTFvS2M1MjF2OHhibS1BUVM2VkxhYl9zbHY2aEE',
        'Презентация': '0B-e8MNz22zZvfkUxcHNRSXgxem1VM1M5ZVRSdUpIRlBMSE8xRVlyWDJvaW1Md3UxLVZPNkU',
        'Другой': '0B-e8MNz22zZvfkRZRkowTnhWUGRwN3U1T0FtLWhRRllkVngxOEhabzVZM280Nm43NGFERE0',
        'Книга': '0B-e8MNz22zZvfkxRMVNNWUR0eXdxd0p4QWJpN3NIOVVkQTI4enh1RDBYd3F1SUxlbF9tQk0',
        'Файл': '0B-e8MNz22zZvfnY4em13Z3hQWFZLN0tvUDF3SC1xS04tY1lWOVZXTV9MNnl4QU1ubE1FeGs'
    },
    /**
     * Какую информацию о файлах спрашивать у Гугла
     */
    DRIVE_FILE_INFO: 'thumbnailLink,id,mimeType,description,title,webContentLink',
    /**
     * Резделитель для делений файла на чанки
     */
    BOUNDARY: '-------314159265358979323846',
    /**
     * Размер чанка
     */
    CHUNK_SIZE: 5242880,
    /**
     * Путь к файлу получения токена
     */
    SERVER_URL: 'getToken.php'
};