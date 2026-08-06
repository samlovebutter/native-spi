#ifndef SPI_BINDING_H
#define SPI_BINDING_H

#include <stdint.h>

#ifdef __cplusplus
extern "C"
{
#endif

    /**
     * Opens an SPI device.
     * @param device device path, for example "/dev/spidev0.0"
     * @return a file descriptor, or -1 on failure
     */
    int32_t spi_open(const char *device);

    /** Returns errno from the last failed operation in the current thread. */
    int32_t spi_get_last_error(void);

    /** Closes a previously opened SPI device. */
    void spi_close(int32_t fd);

    /** Sets the SPI mode and additional spidev mode flags. */
    int32_t spi_set_mode(int32_t fd, uint32_t mode);

    /** Sets the maximum SPI clock rate in Hz. */
    int32_t spi_set_speed(int32_t fd, uint32_t speed);

    /** Sets the number of bits per SPI word. */
    int32_t spi_set_bits_per_word(int32_t fd, uint8_t bits);

    /**
     * Performs a full-duplex transfer.
     * txbuf and rxbuf may be NULL. The length is limited to INT32_MAX bytes.
     * @return the number of transferred bytes, or -1 on failure
     */
    int32_t spi_transfer(
        int32_t fd,
        const uint8_t *txbuf,
        uint8_t *rxbuf,
        uint32_t len
    );

    /**
     * Performs multiple transfers without releasing CS between them.
     * The request and response buffers contain consecutive segments whose
     * boundaries are defined by the lens array.
     * @return the total number of transferred bytes, or -1 on failure
     */
    int32_t spi_transfer_multiple(
        int32_t fd,
        const uint8_t *txbuf,
        uint8_t *rxbuf,
        const uint32_t *lens,
        uint32_t count
    );

    /** Performs a write without receiving data. */
    int32_t spi_write(int32_t fd, const uint8_t *txbuf, uint32_t len);

    /** Performs a read without an explicit transmit buffer. */
    int32_t spi_read(int32_t fd, uint8_t *rxbuf, uint32_t len);

#ifdef __cplusplus
}
#endif

#endif
