#include "spi_binding.h"

#include <errno.h>
#include <fcntl.h>
#include <linux/spi/spidev.h>
#include <stdlib.h>
#include <sys/ioctl.h>
#include <unistd.h>

static _Thread_local int32_t last_error = 0;

static int32_t capture_result(int32_t result)
{
    last_error = result < 0 ? errno : 0;
    return result;
}

static int32_t fail_with_error(int32_t error)
{
    errno = error;
    last_error = error;
    return -1;
}

int32_t spi_open(const char *device)
{
    return capture_result(open(device, O_RDWR));
}

int32_t spi_get_last_error(void)
{
    return last_error;
}

void spi_close(int32_t fd)
{
    close(fd);
}

int32_t spi_set_mode(int32_t fd, uint32_t mode)
{
    return capture_result(ioctl(fd, SPI_IOC_WR_MODE32, &mode));
}

int32_t spi_set_speed(int32_t fd, uint32_t speed)
{
    return capture_result(ioctl(fd, SPI_IOC_WR_MAX_SPEED_HZ, &speed));
}

int32_t spi_set_bits_per_word(int32_t fd, uint8_t bits)
{
    return capture_result(ioctl(fd, SPI_IOC_WR_BITS_PER_WORD, &bits));
}

int32_t spi_transfer(
    int32_t fd,
    const uint8_t *txbuf,
    uint8_t *rxbuf,
    uint32_t len
)
{
    if (len > INT32_MAX)
        return fail_with_error(EOVERFLOW);

    struct spi_ioc_transfer transfer = {
        .tx_buf = (uintptr_t)txbuf,
        .rx_buf = (uintptr_t)rxbuf,
        .len = len,
        // Zero values use the settings configured for the device.
        .speed_hz = 0,
        .bits_per_word = 0,
    };

    return capture_result(ioctl(fd, SPI_IOC_MESSAGE(1), &transfer));
}

int32_t spi_transfer_multiple(
    int32_t fd,
    const uint8_t *txbuf,
    uint8_t *rxbuf,
    const uint32_t *lens,
    uint32_t count
)
{
    if (count == 0)
        return 0;

    if (!lens || SPI_MSGSIZE(count) == 0)
        return fail_with_error(EINVAL);

    uint64_t total_len = 0;
    for (uint32_t index = 0; index < count; index++)
    {
        total_len += lens[index];
        if (total_len > INT32_MAX)
            return fail_with_error(EOVERFLOW);
    }

    if (total_len > 0 && (!txbuf || !rxbuf))
        return fail_with_error(EINVAL);

    struct spi_ioc_transfer *transfers = calloc(count, sizeof(*transfers));
    if (!transfers)
        return fail_with_error(ENOMEM);

    uint32_t offset = 0;
    for (uint32_t index = 0; index < count; index++)
    {
        transfers[index].tx_buf = txbuf ? (uintptr_t)(txbuf + offset) : 0;
        transfers[index].rx_buf = rxbuf ? (uintptr_t)(rxbuf + offset) : 0;
        transfers[index].len = lens[index];
        offset += lens[index];
    }

    int32_t result = ioctl(fd, SPI_IOC_MESSAGE(count), transfers);
    free(transfers);

    return capture_result(result);
}

int32_t spi_write(int32_t fd, const uint8_t *txbuf, uint32_t len)
{
    if (len > INT32_MAX)
        return fail_with_error(EOVERFLOW);

    return capture_result((int32_t)write(fd, txbuf, len));
}

int32_t spi_read(int32_t fd, uint8_t *rxbuf, uint32_t len)
{
    if (len > INT32_MAX)
        return fail_with_error(EOVERFLOW);

    return capture_result((int32_t)read(fd, rxbuf, len));
}
